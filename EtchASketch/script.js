
const container = document.querySelector(".container");

createGrid(16);

const promptButton = document.querySelector(".button");
promptButton.addEventListener("click", ()=>
{
    let inputValue = prompt("How many squares do you want per side for the new grid?")
    if(inputValue != null)
    {
        if (isNaN(inputValue)) {
            alert("That's not a number. Please try again.");
            return; // Stop execution if it's not a number
          }
        
          // 2. Now check if it's a positive integer
          const numberValue = Number(inputValue);
          if (!Number.isInteger(numberValue) || numberValue <= 0) {
            alert("That's not a positive integer. Please try again.");
            return; 
          }

          if(numberValue > 100)
          {
            alert("Too large. Please indicate a size between 1 and 100");
            return; 
          }

          //removes all children
          container.innerHTML = '';
          createGrid(numberValue);
    }
})

function createGrid(gridSize){
    let totalSize = gridSize * gridSize;
    let cellSize = 720 / gridSize;
    for(let i = 0; i < totalSize; i++)
{
    const div = document.createElement("div");
   1 //div.style.border = "thin solid black";
    div.style.width = `${cellSize}px`
    div.style.height = `${cellSize}px`

    div.addEventListener("mouseenter", () =>
    {
        const red = Math.floor(Math.random() * 256);   // Genserate a random integer from 0 to 255 for red
        const green = Math.floor(Math.random() * 256); // Generate a random integer from 0 to 255 for green
        const blue = Math.floor(Math.random() * 256);  // Generate a random integer from 0 to 255 for blue
        const newRandomColor = `rgb(${red}, ${green}, ${blue})`;
        div.style.backgroundColor = newRandomColor;
    })

    div.addEventListener("mouseleave", () =>
    {
        div.style.backgroundColor = "white";
    })

    container.append(div);
    
}
}





