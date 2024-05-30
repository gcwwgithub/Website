document.addEventListener('DOMContentLoaded', function() {
    const inputs = document.querySelectorAll('#form input');
    const form = document.getElementById('form');

    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            input.classList.remove('invalid', 'valid');
        });

        input.addEventListener('input', function() {
            if (input.value === '') {
                input.classList.remove('invalid', 'valid');
            } else if (isValidInput(input)) {
                input.classList.remove('invalid');
                input.classList.add('valid');
            } else {
                input.classList.remove('valid');
                input.classList.add('invalid');
            }
        });
    });

    form.addEventListener('submit', function(event) {
        inputs.forEach(input => {
            if (input.value === '') {
                input.classList.add('invalid');
                event.preventDefault();
            } else if (!isValidInput(input)) {
                input.classList.add('invalid');
                event.preventDefault();
            } else {
                input.classList.add('valid');
            }
        });
    });

    function isValidInput(input) {
        switch (input.type) {
            case 'text':
                return input.value.trim().length > 0;
            case 'email':
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);
            case 'number':
                return !isNaN(input.value) && input.value.trim() !== '';
            default:
                return true;
        }
    }
});