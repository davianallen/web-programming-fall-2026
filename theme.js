//Gets the theme toggle button from the HTML
const themeToggle = document.getElementById("theme-toggle");

//Retreves the previously saved theme from localStorage
const savedTheme = localStorage.getItem("theme");

//Applies dark mode if it was previously selected
if (savedTheme === "dark") {
    document.documentElement.classList.add("dark-theme");
    themeToggle.textContent = "Switch to Light Mode";
}

//Listens for a click on the theme toggle button
themeToggle.addEventListener("click", function() {

    // Adds/removes the dark-theme class
    document.documentElement.classList.toggle("dark-theme");

    //Checks wheter dark mode is currently active
    if (document.documentElement.classList.contains("dark-theme")) {
        themeToggle.textContent = "Switch to Light Mode";
        localStorage.setItem("theme", "dark");
    } else {
        themeToggle.textContent = "Switch to Dark Mode";
        localStorage.setItem("theme", "light");
    }
});