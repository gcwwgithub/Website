document.addEventListener("DOMContentLoaded", function() {
    
    function loadHTML(file, elementId) {
        fetch(file)
            .then(response => response.text())
            .then(data => {
                document.getElementById(elementId).innerHTML = data;
            })
            .catch(error => console.error(`Error loading ${file}:`, error));
    }

    loadHTML("navbar.html", "navbar-container");
    loadHTML("contact.html", "footer-container");
    
    
    let videoContainers = document.querySelectorAll(".video-container");

    videoContainers.forEach(container => {
        let video = container.querySelector(".project-video");
        let thumbnail = container.querySelector(".project-thumbnail");
        video.style.opacity = "0"; // Hide video

        container.addEventListener("mouseenter", function() {
            if (!video.getAttribute("src")) { 
                video.src = container.getAttribute("data-video"); // Load unique video
            }
            video.play();
            thumbnail.style.opacity = "0"; // Show image again
            video.style.opacity = "1"; // Hide video
        });
        

        container.addEventListener("mouseleave", function() {
            video.pause();
            video.currentTime = 0; // Reset video
            thumbnail.style.opacity = "1"; // Show image again
            video.style.opacity = "0"; // Hide video
        });
    });
});