#define _CRT_SECURE_NO_WARNINGS
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <time.h>

#ifndef _strdup
#define _strdup strdup
#endif

#define PORT 8080
#define ROOT "workspace"
#define MAX_REQ (10 * 1024 * 1024)
#define MAX_PATH_LEN 2048

char *escape_json(const char *s) {
    size_t cap = strlen(s) * 6 + 1, j = 0;
    char *out = malloc(cap);
    if (!out) return NULL;

    for (size_t i = 0; s[i]; i++) {
        unsigned char c = (unsigned char)s[i];
        if (c == '"' || c == '\\') {
            out[j++] = '\\';
            out[j++] = c;
        } else if (c == '\n') {
            out[j++] = '\\'; out[j++] = 'n';
        } else if (c == '\r') {
            out[j++] = '\\'; out[j++] = 'r';
        } else if (c == '\t') {
            out[j++] = '\\'; out[j++] = 't';
        } else if (c < 32) {
            j += sprintf(out + j, "\\u%04x", c);
        } else out[j++] = c;
    }
    out[j] = '\0';
    return out;
}

void respond(SOCKET c, int status, const char *reason,
             const char *body) {
    char header[1024];
    int n = snprintf(header, sizeof(header),
        "HTTP/1.1 %d %s\r\n"
        "Content-Type: application/json; charset=utf-8\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n"
        "Access-Control-Allow-Headers: Content-Type, Authorization\r\n"
        "Connection: close\r\n"
        "Content-Length: %zu\r\n\r\n",
        status, reason, strlen(body));

    if (n > 0) send(c, header, n, 0);
    send(c, body, (int)strlen(body), 0);
}

void error_response(SOCKET c, int status, const char *message) {
    char *e = escape_json(message);
    if (!e) {
        respond(c, 500, "Internal Server Error",
                "{\"success\":false,\"error\":\"Memory error\"}");
        return;
    }
    size_t n = strlen(e) + 64;
    char *body = malloc(n);
    if (!body) {
        free(e);
        return;
    }
    snprintf(body, n, "{\"success\":false,\"error\":\"%s\"}", e);
    respond(c, status, status == 404 ? "Not Found" :
            status == 400 ? "Bad Request" : "Error", body);
    free(e);
    free(body);
}

void decode_url(char *s) {
    char *r = s, *w = s;
    while (*r) {
        if (*r == '%' && isxdigit((unsigned char)r[1]) &&
            isxdigit((unsigned char)r[2])) {
            char hex[3] = {r[1], r[2], 0};
            *w++ = (char)strtol(hex, NULL, 16);
            r += 3;
        } else if (*r == '+') {
            *w++ = ' ';
            r++;
        } else *w++ = *r++;
    }
    *w = '\0';
}

void param(const char *query, const char *key,
           char *out, size_t size) {
    out[0] = '\0';
    if (!query || !*query) return;

    char *copy = _strdup(query);
    if (!copy) return;

    for (char *part = strtok(copy, "&");
         part; part = strtok(NULL, "&")) {
        char *eq = strchr(part, '=');
        if (!eq) continue;
        *eq++ = '\0';
        decode_url(part);

        if (_stricmp(part, key) == 0) {
            snprintf(out, size, "%s", eq);
            decode_url(out);
            break;
        }
    }
    free(copy);
}

int safe_path(const char *rel, char *full, size_t size) {
    if (!rel || !*rel || strlen(rel) > 1000) return 0;
    if (rel[0] == '/' || rel[0] == '\\' || strchr(rel, ':'))
        return 0;

    char temp[1024];
    strncpy(temp, rel, sizeof(temp) - 1);
    temp[sizeof(temp) - 1] = '\0';

    for (int i = 0; temp[i]; i++) {
        if (temp[i] == '/') temp[i] = '\\';
        if (temp[i] == '"' || temp[i] == '*' || temp[i] == '?' ||
            temp[i] == '<' || temp[i] == '>' || temp[i] == '|')
            return 0;
    }

    char check[1024];
    strncpy(check, temp, sizeof(check) - 1);
    check[sizeof(check) - 1] = '\0';

    for (char *part = strtok(check, "\\");
         part; part = strtok(NULL, "\\")) {
        if (!strcmp(part, ".") || !strcmp(part, "..")) return 0;
    }

    return snprintf(full, size, "%s\\%s", ROOT, temp) < (int)size;
}

void make_parents(const char *path) {
    char temp[MAX_PATH_LEN];
    snprintf(temp, sizeof(temp), "%s", path);
    for (char *p = temp + strlen(ROOT) + 1; *p; p++) {
        if (*p == '\\' || *p == '/') {
            char save = *p;
            *p = '\0';
            CreateDirectoryA(temp, NULL);
            *p = save;
        }
    }
}

int delete_directory_recursive(const char *folder) {
    char pattern[MAX_PATH_LEN];
    snprintf(pattern, sizeof(pattern), "%s\\*", folder);
    WIN32_FIND_DATAA fd;
    HANDLE h = FindFirstFileA(pattern, &fd);
    if (h == INVALID_HANDLE_VALUE) return 0;

    do {
        if (!strcmp(fd.cFileName, ".") || !strcmp(fd.cFileName, ".."))
            continue;
        char full[MAX_PATH_LEN];
        snprintf(full, sizeof(full), "%s\\%s", folder, fd.cFileName);
        if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
            delete_directory_recursive(full);
        } else {
            DeleteFileA(full);
        }
    } while (FindNextFileA(h, &fd));

    FindClose(h);
    return RemoveDirectoryA(folder);
}

int read_request(SOCKET c, char **request, size_t *length) {
    size_t cap = 8192, used = 0, header_end = 0, body_len = 0;
    char *buf = malloc(cap);
    if (!buf) return 0;

    while (1) {
        if (used == cap) {
            if (cap >= MAX_REQ + 16384) {
                free(buf);
                return 0;
            }
            cap *= 2;
            if (cap > MAX_REQ + 16384) cap = MAX_REQ + 16384;
            char *next = realloc(buf, cap);
            if (!next) { free(buf); return 0; }
            buf = next;
        }

        int n = recv(c, buf + used, (int)(cap - used), 0);
        if (n <= 0) { free(buf); return 0; }
        used += n;

        if (!header_end) {
            for (size_t i = 3; i < used; i++) {
                if (!memcmp(buf + i - 3, "\r\n\r\n", 4)) {
                    header_end = i + 1;
                    break;
                }
            }
            if (header_end) {
                char *h = malloc(header_end + 1);
                if (!h) { free(buf); return 0; }
                memcpy(h, buf, header_end);
                h[header_end] = '\0';

                char *line = strstr(h, "\r\n");
                while (line && *(line + 2) &&
                       strncmp(line + 2, "\r\n", 2)) {
                    line += 2;
                    if (!_strnicmp(line, "Content-Length:", 15)) {
                        body_len = (size_t)strtoull(line + 15, NULL, 10);
                        break;
                    }
                    line = strstr(line, "\r\n");
                }
                free(h);
                if (body_len > MAX_REQ) { free(buf); return 0; }

                if (header_end + body_len + 1 > cap) {
                    cap = header_end + body_len + 1;
                    char *next = realloc(buf, cap);
                    if (!next) { free(buf); return 0; }
                    buf = next;
                }
            }
        }

        if (header_end && used >= header_end + body_len) break;
    }

    *request = buf;
    *length = used;
    return 1;
}

void list_files(const char *folder, const char *relative,
                char **json, size_t *len, size_t *cap, int *first) {
    char pattern[MAX_PATH_LEN];
    snprintf(pattern, sizeof(pattern), "%s\\*", folder);

    WIN32_FIND_DATAA fd;
    HANDLE h = FindFirstFileA(pattern, &fd);
    if (h == INVALID_HANDLE_VALUE) return;

    do {
        if (!strcmp(fd.cFileName, ".") ||
            !strcmp(fd.cFileName, "..")) continue;

        char full[MAX_PATH_LEN], rel[MAX_PATH_LEN];
        snprintf(full, sizeof(full), "%s\\%s", folder, fd.cFileName);
        if (*relative)
            snprintf(rel, sizeof(rel), "%s/%s", relative, fd.cFileName);
        else
            snprintf(rel, sizeof(rel), "%s", fd.cFileName);

        int isdir = !!(fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY);
        ULARGE_INTEGER bytes, ft;
        bytes.HighPart = fd.nFileSizeHigh;
        bytes.LowPart = fd.nFileSizeLow;
        ft.HighPart = fd.ftLastWriteTime.dwHighDateTime;
        ft.LowPart = fd.ftLastWriteTime.dwLowDateTime;

        long long modified =
            (long long)(ft.QuadPart / 10000000ULL) - 11644473600LL;

        const char *dot = strrchr(fd.cFileName, '.');
        char ext[32] = "unknown";
        if (isdir) {
            strcpy(ext, "folder");
        } else if (dot) {
            snprintf(ext, sizeof(ext), "%s", dot);
            for (char *p = ext; *p; p++) *p = (char)tolower((unsigned char)*p);
        }

        time_t raw_time = (time_t)modified;
        struct tm *gmt = gmtime(&raw_time);
        char iso_time[64] = "";
        if (gmt) {
            strftime(iso_time, sizeof(iso_time), "%Y-%m-%dT%H:%M:%SZ", gmt);
        }

        char *er = escape_json(rel), *en = escape_json(fd.cFileName);
        if (er && en) {
            size_t need = strlen(er) * 2 + strlen(en) + 400;
            if (*len + need + 1 > *cap) {
                size_t nc = *cap;
                while (*len + need + 1 > nc) nc *= 2;
                char *p = realloc(*json, nc);
                if (p) { *json = p; *cap = nc; }
            }

            if (*len + need + 1 <= *cap) {
                int n = snprintf(*json + *len, *cap - *len,
                    "%s{\"id\":\"%s\",\"path\":\"%s\","
                    "\"name\":\"%s\",\"size\":%llu,"
                    "\"modified\":%lld,\"modifiedAt\":\"%s\","
                    "\"is_dir\":%s,\"isFolder\":%s,\"extension\":\"%s\"}",
                    *first ? "" : ",", er, er, en,
                    (unsigned long long)(isdir ? 0 : bytes.QuadPart),
                    modified, iso_time,
                    isdir ? "true" : "false",
                    isdir ? "true" : "false",
                    ext);
                if (n > 0) {
                    *len += (size_t)n;
                    *first = 0;
                }
            }
        }
        free(er);
        free(en);

        if (isdir)
            list_files(full, rel, json, len, cap, first);
    } while (FindNextFileA(h, &fd));

    FindClose(h);
}

void handle_client(SOCKET c) {
    char *req = NULL;
    size_t req_len = 0;

    if (!read_request(c, &req, &req_len)) {
        error_response(c, 400, "Invalid HTTP request");
        return;
    }

    char method[16] = {0}, target[4096] = {0};
    sscanf(req, "%15s %4095s", method, target);

    char *head_end = strstr(req, "\r\n\r\n");
    if (!head_end) {
        error_response(c, 400, "Invalid headers");
        free(req);
        return;
    }

    char *body = head_end + 4;
    size_t body_len = req_len - (size_t)(body - req);
    char *query = strchr(target, '?');
    if (query) *query++ = '\0'; else query = "";

    if (!strcmp(method, "OPTIONS")) {
        respond(c, 204, "No Content", "");
    }
    else if (!strcmp(target, "/api/health") &&
             !strcmp(method, "GET")) {
        respond(c, 200, "OK",
            "{\"success\":true,\"message\":\"C server is running\"}");
    }
    else if (!strcmp(method, "GET") &&
             (!strcmp(target, "/api/files") ||
              !strcmp(target, "/api/tree") ||
              !strcmp(target, "/api/dashboard"))) {
        size_t cap = 4096, len = 0;
        char *json = malloc(cap);
        int first = 1;
        if (!json) {
            error_response(c, 500, "Out of memory");
        } else {
            len = sprintf(json, "{\"success\":true,\"files\":[");
            list_files(ROOT, "", &json, &len, &cap, &first);
            if (len + 3 > cap) {
                char *p = realloc(json, len + 3);
                if (p) { json = p; cap = len + 3; }
            }
            if (len + 3 <= cap) {
                memcpy(json + len, "]}", 3);
                respond(c, 200, "OK", json);
            } else error_response(c, 500, "Response too large");
            free(json);
        }
    }
    else if (!strcmp(target, "/api/create") &&
             !strcmp(method, "POST")) {
        char rel[1024] = {0}, type[32] = {0}, full[MAX_PATH_LEN];
        param(query, "path", rel, sizeof(rel));
        param(query, "type", type, sizeof(type));

        if (!safe_path(rel, full, sizeof(full))) {
            error_response(c, 400, "Invalid path");
        } else {
            make_parents(full);
            if (!_stricmp(type, "folder")) {
                if (CreateDirectoryA(full, NULL))
                    respond(c, 200, "OK", "{\"success\":true}");
                else error_response(c, 409, "Folder already exists or cannot be created");
            } else {
                FILE *f = fopen(full, "wb");
                if (!f) error_response(c, 409, "File already exists or cannot be created");
                else {
                    size_t wrote = fwrite(body, 1, body_len, f);
                    fclose(f);
                    if (wrote == body_len)
                        respond(c, 200, "OK", "{\"success\":true}");
                    else error_response(c, 500, "Cannot write file");
                }
            }
        }
    }
    else if (!strcmp(target, "/api/content") &&
             !strcmp(method, "GET")) {
        char rel[1024] = {0}, full[MAX_PATH_LEN];
        param(query, "path", rel, sizeof(rel));
        if (!safe_path(rel, full, sizeof(full))) {
            error_response(c, 400, "Invalid path");
        } else {
            FILE *f = fopen(full, "rb");
            if (!f) error_response(c, 404, "File not found");
            else {
                fseek(f, 0, SEEK_END);
                long n = ftell(f);
                rewind(f);
                if (n < 0 || n > MAX_REQ) {
                    fclose(f);
                    error_response(c, 400, "File too large");
                } else {
                    char *text = malloc((size_t)n + 1);
                    if (!text) {
                        fclose(f);
                        error_response(c, 500, "Out of memory");
                    } else {
                        size_t got = fread(text, 1, (size_t)n, f);
                        fclose(f);
                        text[got] = '\0';
                        char *e = escape_json(text);
                        if (e) {
                            size_t cap = strlen(e) + 64;
                            char *out = malloc(cap);
                            if (out) {
                                snprintf(out, cap,
                                    "{\"success\":true,\"content\":\"%s\"}", e);
                                respond(c, 200, "OK", out);
                                free(out);
                            } else error_response(c, 500, "Out of memory");
                            free(e);
                        } else error_response(c, 500, "Out of memory");
                        free(text);
                    }
                }
            }
        }
    }
    else if (!strcmp(target, "/api/content") &&
             !strcmp(method, "PUT")) {
        char rel[1024] = {0}, full[MAX_PATH_LEN];
        param(query, "path", rel, sizeof(rel));
        if (!safe_path(rel, full, sizeof(full))) {
            error_response(c, 400, "Invalid path");
        } else {
            FILE *f = fopen(full, "wb");
            if (!f) error_response(c, 404, "Cannot open file");
            else {
                size_t wrote = fwrite(body, 1, body_len, f);
                fclose(f);
                if (wrote == body_len)
                    respond(c, 200, "OK", "{\"success\":true}");
                else error_response(c, 500, "Cannot save file");
            }
        }
    }
    else if (!strcmp(target, "/api/upload") &&
             !strcmp(method, "POST")) {
        char rel[1024] = {0}, full[MAX_PATH_LEN];
        param(query, "path", rel, sizeof(rel));
        if (!safe_path(rel, full, sizeof(full))) {
            error_response(c, 400, "Invalid path");
        } else {
            make_parents(full);
            FILE *f = fopen(full, "wb");
            if (!f) error_response(c, 500, "Upload failed");
            else {
                size_t wrote = fwrite(body, 1, body_len, f);
                fclose(f);
                if (wrote == body_len)
                    respond(c, 200, "OK", "{\"success\":true}");
                else error_response(c, 500, "Upload write failed");
            }
        }
    }
    else if (!strcmp(target, "/api/rename") &&
             !strcmp(method, "POST")) {
        char rel[1024] = {0}, name[256] = {0};
        char full[MAX_PATH_LEN], dest[MAX_PATH_LEN], parent[MAX_PATH_LEN] = "";
        param(query, "path", rel, sizeof(rel));
        param(query, "name", name, sizeof(name));

        if (!safe_path(rel, full, sizeof(full)) || !*name ||
            strchr(name, '/') || strchr(name, '\\') ||
            strchr(name, ':') || !strcmp(name, ".") ||
            !strcmp(name, "..") || strchr(name, '?') ||
            strchr(name, '*') || strchr(name, '|') ||
            strchr(name, '<') || strchr(name, '>')) {
            error_response(c, 400, "Invalid name or path");
        } else {
            char *slash = strrchr(full, '\\');
            if (slash) {
                size_t n = (size_t)(slash - full + 1);
                memcpy(parent, full, n);
                parent[n] = '\0';
            }
            snprintf(dest, sizeof(dest), "%s%s", parent, name);
            if (MoveFileA(full, dest))
                respond(c, 200, "OK", "{\"success\":true}");
            else error_response(c, 409, "Rename failed");
        }
    }
    else if (!strcmp(target, "/api/delete") &&
             !strcmp(method, "DELETE")) {
        char rel[1024] = {0}, full[MAX_PATH_LEN];
        param(query, "path", rel, sizeof(rel));

        if (!safe_path(rel, full, sizeof(full))) {
            error_response(c, 400, "Invalid path");
        } else {
            DWORD attr = GetFileAttributesA(full);
            if (attr == INVALID_FILE_ATTRIBUTES) {
                error_response(c, 404, "Path not found");
            } else if (attr & FILE_ATTRIBUTE_DIRECTORY) {
                if (delete_directory_recursive(full))
                    respond(c, 200, "OK", "{\"success\":true}");
                else error_response(c, 500, "Delete directory failed");
            } else if (DeleteFileA(full)) {
                respond(c, 200, "OK", "{\"success\":true}");
            } else error_response(c, 500, "Delete failed");
        }
    }
    else if (!strcmp(target, "/api/duplicate") &&
             !strcmp(method, "POST")) {
        char rel[1024] = {0}, src[MAX_PATH_LEN], dst[MAX_PATH_LEN];
        param(query, "path", rel, sizeof(rel));

        if (!safe_path(rel, src, sizeof(src))) {
            error_response(c, 400, "Invalid path");
        } else {
            char *slash = strrchr(src, '\\');
            char *base = slash ? slash + 1 : src;
            char parent[MAX_PATH_LEN] = "";
            if (slash) {
                size_t n = (size_t)(slash - src + 1);
                memcpy(parent, src, n);
                parent[n] = '\0';
            }

            char stem[512];
            snprintf(stem, sizeof(stem), "%s", base);
            char *dot = strrchr(stem, '.');
            char ext[128] = "";
            if (dot && dot != stem) {
                snprintf(ext, sizeof(ext), "%s", dot);
                *dot = '\0';
            }

            FILE *in = fopen(src, "rb");
            if (!in) error_response(c, 404, "File not found");
            else {
                int copied = 0;
                for (int i = 1; i < 1000; i++) {
                    snprintf(dst, sizeof(dst), "%s%s_copy%d%s",
                             parent, stem, i, ext);
                    FILE *out = fopen(dst, "rb");
                    if (out) { fclose(out); continue; }
                    out = fopen(dst, "wb");
                    if (!out) break;

                    char buf[8192];
                    size_t n;
                    int ok = 1;
                    while ((n = fread(buf, 1, sizeof(buf), in)) > 0) {
                        if (fwrite(buf, 1, n, out) != n) {
                            ok = 0;
                            break;
                        }
                    }
                    fclose(out);
                    copied = ok && !ferror(in);
                    break;
                }
                fclose(in);
                if (copied) respond(c, 200, "OK", "{\"success\":true}");
                else error_response(c, 500, "Duplicate failed");
            }
        }
    }
    else {
        error_response(c, 404, "Unknown endpoint");
    }

    free(req);
}

void init_sample_files(void) {
    DWORD attr = GetFileAttributesA(ROOT);
    if (attr != INVALID_FILE_ATTRIBUTES && !(attr & FILE_ATTRIBUTE_DIRECTORY)) {
        DeleteFileA(ROOT);
    }
    CreateDirectoryA(ROOT, NULL);
    CreateDirectoryA(ROOT "\\algorithms", NULL);
    CreateDirectoryA(ROOT "\\data_structures", NULL);

    char path[MAX_PATH_LEN];
    snprintf(path, sizeof(path), "%s\\algorithms\\BinarySearchTree.cpp", ROOT);
    FILE *f = fopen(path, "rb");
    if (!f) {
        f = fopen(path, "wb");
        if (f) {
            const char *code =
                "#include <iostream>\n\n"
                "struct Node {\n"
                "    int val;\n"
                "    Node *left, *right;\n"
                "    Node(int v) : val(v), left(nullptr), right(nullptr) {}\n"
                "};\n\n"
                "int main() {\n"
                "    std::cout << \"BST ready\" << std::endl;\n"
                "    return 0;\n"
                "}\n";
            fwrite(code, 1, strlen(code), f);
            fclose(f);
        }
    } else {
        fclose(f);
    }
}

int main(void) {
    WSADATA wsa;
    init_sample_files();

    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        puts("Winsock startup failed.");
        return 1;
    }

    SOCKET server = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (server == INVALID_SOCKET) {
        puts("Socket creation failed.");
        WSACleanup();
        return 1;
    }

    int opt = 1;
    setsockopt(server, SOL_SOCKET, SO_REUSEADDR, (const char *)&opt, sizeof(opt));

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_port = htons(PORT);
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

    if (bind(server, (struct sockaddr *)&addr, sizeof(addr)) == SOCKET_ERROR) {
        printf("Cannot use port %d. Is it already occupied?\n", PORT);
        closesocket(server);
        WSACleanup();
        return 1;
    }

    if (listen(server, 10) == SOCKET_ERROR) {
        puts("Listen failed.");
        closesocket(server);
        WSACleanup();
        return 1;
    }

    printf("C backend running at http://127.0.0.1:%d\n", PORT);
    printf("Files are stored in %s\\\n", ROOT);
    puts("Press Ctrl+C to stop.");

    while (1) {
        SOCKET client = accept(server, NULL, NULL);
        if (client == INVALID_SOCKET) continue;
        handle_client(client);
        shutdown(client, SD_SEND);
        closesocket(client);
    }

    closesocket(server);
    WSACleanup();
    return 0;
}
