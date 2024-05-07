
const OPERATORS = Object.freeze({
    PLUS: '+',
    MINUS: '-',
    MULTIPLY: '*',
    DIVIDE: '/',
    MODULUS: '%'
  });

  const multiplyOperator = 'X';  // Escaping multiplication operator
  const divideOperator = '÷';    // Escaping division operator
  const maxCalculatorLength = 13;


function add(number1, number2)
{
    return number1 + number2;
}

function subtract(number1, number2)
{
    return number1 - number2;
}

function multiply(number1, number2)
{
    return number1 * number2;
}

function divide(number1, number2)
{
    return number1 / number2;
}

function modulus(number1, number2)
{
    return number1 % number2;
}


function operate(operator, left, right)
{

    let result = 0;

    if(!isNaN(left) && !isNaN(right))
    {
        switch (operator) {
            case OPERATORS.PLUS:
                result = add(left, right);
                console.log(left + " + " + right); 
                break;
            case OPERATORS.MINUS:
                result = subtract(left, right);
                console.log(left + " - " + right); 
                break; 
            case OPERATORS.MULTIPLY:
                result = multiply(left, right);
                console.log(left + " * " + right); 
                break;
            case OPERATORS.DIVIDE:
                result = divide(left, right);
                console.log(left + " / " + right); 
                break;
            case OPERATORS.MODULUS:
                result = modulus(left, right);
                console.log(left + " % " + right); 
                break;
            default:
              console.log("Invalid action");
          }
    }

    else{
        console.log("Invalid operands");
    }



      return result;
}

let expression = "";
let leftBracketCount = 0;


const displayScreen = document.querySelector(".screen");

const calculatorButtons = document.querySelectorAll(".option");
calculatorButtons.forEach(button => {
    button.addEventListener("click", () => {
        if(expression.length > maxCalculatorLength)
        {
            return;
        }
        
        if (expression === "0" || expression === "ERROR") {
            expression = button.textContent;
        } 
        else {
            expression += button.textContent;
        }
        displayScreen.textContent = expression;
    });
});

const bracketButton = document.querySelector(".bracket");
bracketButton.addEventListener("click", () => {
    let leftBracket = "(";
    let rightBracket = ")";

    if(expression.length > maxCalculatorLength)
        {
            return;
        }

    if (expression === "0" || expression === "ERROR") {
        expression = leftBracket;
    }

    else if(expression)
    {
        if(expression[expression.length - 1] === "(")
        {
            console.log("Test");
            expression += leftBracket;
            leftBracketCount++;
        }

        else if(leftBracketCount > 0)
        {
            console.log("Test2");
            expression += rightBracket;
            leftBracketCount--;
        }

        else
        {
            console.log("Test3");
            expression += leftBracket;
            leftBracketCount++;
        }
    }

    else
    {
        console.log("Test4");
        expression = leftBracket;
        leftBracketCount++;
    }

    displayScreen.textContent = expression;
});

const operatorButtons = document.querySelectorAll(".operator");
operatorButtons.forEach(button =>
{
    button.addEventListener("click", () => {
        
        if(expression.length > maxCalculatorLength)
        {
            return;
        }

        if(expression)
        {
            if(isOperator(expression[expression.length - 1]))
            {
                console.log("Operator already there");
                return;
            }
        }
        expression += button.textContent;
        displayScreen.textContent = expression;
    });

});


const clearButton = document.querySelector(".clear");
clearButton.addEventListener("click", () => {
    leftBracketCount = 0;
    displayScreen.textContent = "0";
    expression = "0";
});

const backButton = document.querySelector(".back");
backButton.addEventListener("click", () => {
    if(expression === "ERROR" || expression === "0")
    {
        return;
    }

    if(expression)
    {
        if(expression[expression.length - 1] === "(")
        {
            leftBracketCount--;
        }

        else if(expression[expression.length - 1] === ")")
        {
            leftBracketCount++;
        }
    }

    expression = expression.slice(0,-1);
    displayScreen.textContent = expression;
});

const equalsButton = document.querySelector(".equals");
equalsButton.addEventListener("click", () => {

    //Step 1: Prepartion Work
    const stack = new Stack();
    const outqueue = new Queue();
    const rpnStack = new Stack();

    let failure = false;
    let regexMultiplyOperator = "\\" + multiplyOperator;
    let regexDivideOperator = "\\" + divideOperator;
    

    //Step 2: Parse Input using regex
    let pattern = [
        "\\d*\\.\\d+",    // Matches floating point numbers
        "\\d+",           // Matches integers
        `[\\+\\-${regexMultiplyOperator}${regexDivideOperator}()%]`, // Matches +, -, *, /, %, (, and )
        "\\^"             // Matches the caret for exponentiation
    ].join('|');
    
    let regex = new RegExp(pattern, 'g');
    const tokens = expression.match(regex);

    if(failure === true)
    {
        expression = "ERROR";
        displayScreen.textContent = expression;
        return;
    }


    //Step 3: Shunting Yard Algorithm
    tokens.forEach(element => {
        console.log(element);
        if(!isNaN(element))
        { 
          console.log("Is a number");
          outqueue.enqueue(element);

        }
 
        else if(element === ")")
         {
            console.log("Is Right Bracket");
             let leftBracketFound = false;
             while(stack.length() > 0)
             {
                 if(stack.peek() === "(")
                 {
                     leftBracketFound = true;
                     stack.pop();
                     break;
                 }
 
                 outqueue.enqueue(stack.pop());
             }
 
             if(leftBracketFound === false)
             {
                console.log("Left Bracket not Found");
                 failure = true;
             }
         }
 
         else if(element === "(")
         {
            console.log("Is Left Bracket");
             stack.push(element);
         }
 
         else
         {
             console.log("Is Operator");
             while(stack.length() > 0)
             {
                 if(shouldPopOperatorFromStack(element, stack.peek()))
                 {
                    console.log("need pop from stack" + element);
                     outqueue.enqueue(stack.pop());
                 }
 
                 else
                 {
                    console.log("no need pop from stack");
                     break;
                 }
             }

             stack.push(element);

         }
     });
 
     while(stack.length() > 0)
     { 
       
         if(stack.peek() === "(")
         {
            console.log("Stray Left Bracket Found");
             failure = true;
             break;
         }

         outqueue.enqueue(stack.pop());

     }


 
     if(failure === true)
     {
         expression = "ERROR";
         displayScreen.textContent = expression;
         return;
     }

     console.log("STEP 4, QUEUE LENGTH IS NOW " + outqueue.length());

     //Step 4: Evaluate RPN
     while(outqueue.length() > 0)
     {
        let element = outqueue.dequeue();
        console.log("Element is " + element);
        if(typeof element === "number")
        {
            console.log("is a number");
            rpnStack.push(element);
        }

        else if(!isNaN(element))
        {  
          console.log("is a string number");
          rpnStack.push(Number(element));
        }

        else
        {
            console.log("is a operator");
            if(rpnStack.length < 2)
            {
                console.log("RPN STACK LESS THAN 2");
                failure = true;
                break;
            }

            const right = rpnStack.pop();
            const left = rpnStack.pop();
            let result = 0;
            if(element === "+")
            {  
                result = operate(OPERATORS.PLUS, left, right);
            }

            else if(element === "-")
            {
                result = operate(OPERATORS.MINUS, left, right);
            }

            else if(element === multiplyOperator)
            {
                result = operate(OPERATORS.MULTIPLY, left, right);
            }

            else if(element === divideOperator)
            {
                result =  operate(OPERATORS.DIVIDE, left, right);
            }

            else if(element === "%")
            {
                result =  operate(OPERATORS.MODULUS, left, right);
            }
            else
            { 
                console.log("UKNOWN OPERATOR" + element);
                failure = true;
                break;
            }
            rpnStack.push(result);
            
        }
    }

    if(rpnStack.length() > 1)
    {
        failure = true;
        console.log("Length of rpm stack is greater than 1");
    }

    let finalResult = rpnStack.pop();
    if(typeof finalResult != "number")
    { 
        console.log("ITS NOT A NUMBER" + finalResult );
        failure = true;
    }

    if(failure === true)
    {
        expression = "ERROR";
        displayScreen.textContent = expression;
        return;
    }

    //Step 5: Update Calculator
    leftBracketCount = 0;
    expression = finalResult;
    displayScreen.textContent = expression;
    console.log( displayScreen.textContent );

});

function shouldPopOperatorFromStack(currentOperator, stackOperator)
{
    if(currentOperator === multiplyOperator || currentOperator === divideOperator || currentOperator === "%")
    {
        if(stackOperator === multiplyOperator || stackOperator === divideOperator || stackOperator === "%")
        {
            return true;
        }

        else
        {
            return false;
        }
    }

    if(stackOperator === "(")
    {
        return false;
    }

    return true;
}

function isOperator(lastCharacter)
{
    return lastCharacter === "+" || lastCharacter === "-" || lastCharacter === multiplyOperator || lastCharacter === divideOperator || lastCharacter === "%";
}


