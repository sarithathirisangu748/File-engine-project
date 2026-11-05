#include <iostream>

struct Node {
    int val;
    Node *left, *right;
    Node(int v) : val(v), left(nullptr), right(nullptr) {}
};

int main() {
    std::cout << "BST ready" << std::endl;
    return 0;
}
