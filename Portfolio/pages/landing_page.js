document.addEventListener("DOMContentLoaded", function () {
    let videoContainers = document.querySelectorAll(".video-container");

    videoContainers.forEach(container => {
        let video = container.querySelector(".project-video");
        let thumbnail = container.querySelector(".project-thumbnail");

        video.style.opacity = "0"; // Hide video initially
        let videoLoading = false; // Track if video is loading

        container.addEventListener("mouseenter", function () {
            if (!video.getAttribute("src")) { 
                video.src = container.getAttribute("data-video"); 
            }

            videoLoading = true; // Video is now loading
            video.load(); // Start loading the video

            // Keep thumbnail visible until the video can play
            video.oncanplaythrough = function () {
                if (videoLoading) {
                    video.style.opacity = "1"; // Show video
                    thumbnail.style.opacity = "0"; // Hide thumbnail
                }
            };

            // Prevent play() error using try/catch
            video.play().catch(error => {
                if (error.name !== "AbortError") {
                    console.error("Video play error:", error);
                }
            });
        });

        container.addEventListener("mouseleave", function() {
            videoLoading = false; // User left, stop loading

            // Only call pause() if the video is actually playing
            if (!video.paused) {
                video.pause();
                video.currentTime = 0; // Reset video
            }

            // If video is still loading, stop fetching
            if (video.readyState < 4) {
                video.removeAttribute("src"); // Cancel loading
            }

            thumbnail.style.opacity = "1"; // Show image again
            video.style.opacity = "0"; // Hide video
        });
    });
});
