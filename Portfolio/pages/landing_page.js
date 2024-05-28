document.getElementById('downloadButton').addEventListener('click', function() {
    console.log("test")
    // URL of the file you want to download
    const fileUrl = '../images/GabrielChiok_Resume.pdf'; // e.g., 'files/sample.pdf'
    
    // The name of the file after download
    const fileName = 'GabrielChiok_Resume.pdf'; // e.g., 'sample.pdf'
    
    // Create a temporary link element
    const link = document.getElementById('downloadLink');
    link.href = fileUrl;
    link.download = fileName;

    // Trigger the download by programmatically clicking the link
    link.click();
});