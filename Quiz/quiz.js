
const sheetID = '1CKAz8xbMRtSwhLHP8iyfCxx04_3ODCKGhMw1Uz2Egj8';
const apiKey = 'AIzaSyC_uFW7plhcjxBGZa37grEjo3ya0Isi83g';
let quizData = [];
let correctAnswer = "option1";
const buttons = document.querySelectorAll('.option');
const questionID =  document.getElementById('question-id')
const nextButton = document.getElementById('next')

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); 
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
  return array;
}

function updateQuiz() {

  buttons.forEach((button) => {
    button.style.backgroundColor = 'white'
  });


  const min = 0;
  const max = quizData.length-1;
  const randomNumberInRange = Math.floor(Math.random() * (max - min + 1)) + min;
  const currentQuestion = quizData[randomNumberInRange];

  questionID.innerText = currentQuestion[0] + currentQuestion[1];

  let random = [currentQuestion[5], currentQuestion[9], currentQuestion[10], currentQuestion[11]];
  let tempCorrectAnswer = currentQuestion[5];
  random = shuffleArray(random);
  for(let i = 0; i < 4; i++)
  {
    if(tempCorrectAnswer === random[i])
    {
      correctAnswer = "option" + (i + 1);
      console.log(tempCorrectAnswer + " " + random[i]);
    }
  }


  document.getElementById('questionText').innerText = currentQuestion[3]
  document.getElementById('option1').innerText = random[0];
  document.getElementById('option2').innerText = random[1];
  document.getElementById('option3').innerText = random[2];
  document.getElementById('option4').innerText = random[3];
}

  async function fetchQuizData() {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}?key=${apiKey}`);
    const metadata = await response.json();

     // Retrieve data from each sheet
  const sheetPromises = metadata.sheets.map(sheet => {
    const sheetName = sheet.properties.title;
    return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheetName}?key=${apiKey}`)
      .then(response => {
        if (!response.ok) {
          console.error(`Failed to fetch data from sheet ${sheetName}:`, response.status, response.statusText);
          return null; // Return null if the request fails
        }
        return response.json();
      });
  });
  
  const allSheetsData = await Promise.all(sheetPromises);
  
  // Combine data from all sheets, skipping any that failed to load
  const combinedData = allSheetsData.reduce((acc, sheetData) => {
    if (sheetData && sheetData.values) {
      return acc.concat(sheetData.values.slice(1)); // Exclude the first row
    }
    return acc;
  }, []);
  
  
  return combinedData;
    }

    function submitAnswer(event) {
      buttons.forEach((button) => {
        if(button.id === correctAnswer){
          button.style.backgroundColor = 'green'
        }

        else{
          button.style.backgroundColor = 'red'
        }
        
      });
    }


async function initQuiz() {
  quizData = await fetchQuizData();
  if (quizData && quizData.length > 1) {
    console.log('Quiz data loaded successfully:', quizData);
  } else {
    console.error('No quiz data found or there was an error loading the data.');
  }

  
  buttons.forEach((button, index) => {
    button.dataset.option = index + 1; // Set data attribute to identify the option
    button.addEventListener('click', submitAnswer);
  });

  nextButton.addEventListener('click', updateQuiz);

  updateQuiz();
}

window.onload = initQuiz;
