class Queue {
    constructor() {
        this.items = [];  // The queue starts empty
    }

    // Enqueue element to the end of the queue
    enqueue(element) {
        this.items.push(element);
    }

    // Dequeue the first element from the queue
    dequeue() {
        if (this.items.length === 0) {
            return 'Queue is empty';
        }
        return this.items.shift();
    }

    // Peek at the front of the queue
    peek() {
        if (this.items.length === 0) {
            return 'Queue is empty';
        }
        return this.items[0];
    }

    // Check if the queue is empty
    isEmpty() {
        return this.items.length === 0;
    }

    // View the queue
    view() {
        return this.items;
    }

    length(){
        return this.items.length;
    }
}
