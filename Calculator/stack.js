class Stack {
    constructor() {
        this.items = [];  // The stack starts empty
    }

    // Push element onto the stack
    push(element) {
        this.items.push(element);
    }

    // Pop element from the stack
    pop() {
        if (this.items.length === 0) {
            return 'Stack is empty';
        }
        return this.items.pop();
    }

    // Peek at the top element of the stack
    peek() {
        if (this.items.length === 0) {
            return 'Stack is empty';
        }
        return this.items[this.items.length - 1];
    }

    // Check if the stack is empty
    isEmpty() {
        return this.items.length === 0;
    }

    // View the stack
    view() {
        return this.items;
    }

    length(){
       return this.items.length;
    }
}
