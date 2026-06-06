/**
 * Interactive Grid Calculator Logic
 * * CORE CONCEPTS COVERED:
 * 1. DOM Traversal & State Management
 * 2. Event Delegation
 * 3. String Manipulation & Edge Case Handling
 * 4. Input Sanitization & Dynamic Evaluation
 */

// --- 1. DOM Elements & State ---
const display = document.getElementById('display');
const keyGrid = document.getElementById('key-grid');

// We store our mathematical expression as a string.
// Example: "14+5.5*2"
let currentExpression = ''; 
let shouldResetDisplay = false; // Flag to check if we need to clear the screen after a calculation

// --- 2. Event Delegation ---
/*
 * WHY EVENT DELEGATION?
 * Instead of finding all 17 buttons and attaching 17 individual `addEventListener` functions,
 * we attach a SINGLE listener to the parent container (`keyGrid`).
 * * Because events "bubble up" the DOM tree, when a button is clicked, the click event 
 * eventually reaches the parent container. We can then inspect `event.target` to see 
 * exactly which element was clicked and execute logic accordingly. This saves memory
 * and improves performance.
 */
keyGrid.addEventListener('click', function(event) {
    // If the clicked element is not a button, ignore it.
    if (!event.target.matches('button')) return;

    const button = event.target;
    const action = button.dataset.action;
    const buttonValue = button.dataset.val;

    // Route the click to the correct function based on the button's data-action
    if (!action) {
        // If there's no data-action, it's a number
        handleNumber(buttonValue);
    } else if (action === 'operator') {
        handleOperator(buttonValue);
    } else if (action === 'decimal') {
        handleDecimal();
    } else if (action === 'clear') {
        handleClear();
    } else if (action === 'calculate') {
        handleCalculate();
    }

    // Update the visual display after every interaction
    updateDisplay();
});


// --- 3. String Manipulation & Logic ---

function handleNumber(numberStr) {
    // If a calculation just finished and the user types a new number, start fresh
    if (shouldResetDisplay) {
        currentExpression = '';
        shouldResetDisplay = false;
    }
    currentExpression += numberStr;
}

function handleOperator(operatorStr) {
    shouldResetDisplay = false;
    
    // EDGE CASE: Do not allow the user to start with an operator (except minus for negative numbers)
    if (currentExpression === '' && operatorStr !== '-') return;

    // EDGE CASE: Consecutive operators. 
    // If the last character is already an operator, we shouldn't append another one.
    // Instead, we REPLACE the last operator with the newly clicked one.
    const lastChar = currentExpression.slice(-1);
    const operators = ['+', '-', '*', '/'];
    
    if (operators.includes(lastChar)) {
        // Slice off the last character and add the new operator
        currentExpression = currentExpression.slice(0, -1) + operatorStr;
        return;
    }

    currentExpression += operatorStr;
}

function handleDecimal() {
    if (shouldResetDisplay) {
        currentExpression = '0';
        shouldResetDisplay = false;
    }

    /* * EDGE CASE: Multiple decimal points in a single number (e.g., "5.5.5").
     * LOGIC: We split the entire string expression by mathematical operators. 
     * This isolates the *current* number the user is typing. If that current 
     * number already includes a decimal point, we refuse to add another one.
     */
    const numbersInExpression = currentExpression.split(/[\+\-\*\/]/);
    const currentNumber = numbersInExpression[numbersInExpression.length - 1];

    if (!currentNumber.includes('.')) {
        // If the expression is empty or ends with an operator, prepend a '0' before the decimal
        if (currentExpression === '' || /[\+\-\*\/]$/.test(currentExpression)) {
            currentExpression += '0.';
        } else {
            currentExpression += '.';
        }
    }
}

function handleClear() {
    currentExpression = '';
    shouldResetDisplay = false;
}

// --- 4. Math Operations & Input Sanitization ---

function handleCalculate() {
    if (currentExpression === '') return;

    try {
        /*
         * SECURITY & SANITIZATION:
         * Using `eval()` can be extremely dangerous in JavaScript if user input is allowed
         * (it can execute arbitrary code). To use it safely for a calculator, we MUST 
         * strictly sanitize the string to ensure it ONLY contains numbers and operators.
         */
        
        // Regex check: If the string contains anything other than digits, dots, and +-*/, reject it.
        if (/[^0-9+\-*/.]/.test(currentExpression)) {
            throw new Error("Invalid characters in expression");
        }

        // Safely evaluate the sanitized string
        // We use a safe wrapper over eval: Function allows us to execute a strict return statement
        const result = new Function('return ' + currentExpression)();
        
        // Handle floating point precision errors (e.g., 0.1 + 0.2 = 0.30000000000000004)
        // We parse it back to a float and use toFixed(8) to limit decimals, then strip trailing zeroes
        let formattedResult = parseFloat(result.toFixed(8)).toString();
        
        // Handle infinity (e.g., dividing by zero)
        if (!isFinite(result)) {
            formattedResult = 'Error';
        }

        currentExpression = formattedResult;
        shouldResetDisplay = true; // Next number clicked will start a new expression

    } catch (error) {
        currentExpression = 'Error';
        shouldResetDisplay = true;
    }
}

// --- Utility Function ---
function updateDisplay() {
    // If the expression is empty, show 0, otherwise show the expression.
    display.textContent = currentExpression === '' ? '0' : currentExpression;
}