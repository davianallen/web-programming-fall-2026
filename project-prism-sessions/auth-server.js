
const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const path = require("path");
const session = require("express-session");
require("dotenv").config();

const app = express();
const PORT = 3001;

//Read HTML form submissions and JSON requests
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

//Make sure a session secret is configured
if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is missing from .env");
}

//Configure session storage for logged-in users
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false, //Local development uses HTTP
        maxAge: 60 * 60 * 1000 //One hour
    }
}));

//Serve the website's HTML, CSS, and JavaScript files
app.use(express.static(path.join(__dirname, "public")));

//Connect to the Project Prism database
const db = mysql.createPool({
    host: "127.0.0.1",
    user: "prism_app",
    password: process.env.DB_PASSWORD,
    database: "project_prism",
    port: 3306
});

//Test the database connection
db.query("SELECT 1")
    .then(() => {
        console.log("MySQL connection successful!");
    })
    .catch((err) => {
        console.error("MySQL connection failed:", err.code, err.message);
    });

//Registration endpoint
app.post("/register", async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).send("All fields are required.");
    }

    try {
        //Hash the password before storing it
        const passwordHash = await bcrypt.hash(password, 12);

        const sql = `
            INSERT INTO accounts (username, email, password_hash)
            VALUES (?, ?, ?)
        `;

        await db.execute(sql, [
            username.trim(),
            email.trim(),
            passwordHash
        ]);

        res.send(`
            <h2>You have successfully registered</h2>
            <a href="/login.html">Go to Login</a>
        `);

    } catch (err) {
        console.error("Registration error:", err);

        if (err.code === "ER_DUP_ENTRY") {
            return res.status(409).send(`
                <p>Username or email already exists.</p>
                <a href="/register.html">Try again</a>
            `);
        }

        res.status(500).send("Registration failed.");
    }
});

//Login endpoint
app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    const invalidMessage = `
        <h2>The login credentials were incorrect</h2>
        <a href="/login.html">Back to Login</a>
    `;

    if (!username || !password) {
        return res.status(401).send(invalidMessage);
    }

    try {
        //Find the account matching the entered username
        const sql = `
            SELECT username, password_hash
            FROM accounts
            WHERE username = ?
        `;

        const [results] = await db.execute(sql, [username.trim()]);

        if (results.length === 0) {
            return res.status(401).send(invalidMessage);
        }

        //Compare the entered password with the stored hash
        const validPassword = await bcrypt.compare(
            password,
            results[0].password_hash
        );

        if (!validPassword) {
            return res.status(401).send(invalidMessage);
        }

        //SESSION FEATURE:
        //Create a fresh session after successful login
        req.session.regenerate((err) => {
            if (err) {
                console.error("Session creation error:", err);
                return res.status(500).send("Session creation failed.");
            }

            //Store the authenticated username in the session
            req.session.username = results[0].username;

            //Save the session before opening the profile page
            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error("Session save error:", saveErr);
                    return res.status(500).send("Session save failed.");
                }

                res.redirect("/profile");
            });
        });

    } catch (err) {
        console.error("Login error:", err);
        res.status(500).send("Login failed due to a server error.");
    }
});

//Escape special characters before displaying text in HTML
function escapeHtml(value) {
    const characters = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    };

    return String(value).replace(
        /[&<>"']/g,
        (character) => characters[character]
    );
}

//PROFILE ENDPOINT:
//Display the username saved in the session
app.get("/profile", (req, res) => {

    //Redirect visitors who are not logged in.
    if (!req.session.username) {
        return res.redirect("/login.html");
    }

    //Prevent the browser from caching this private page
    res.set("Cache-Control", "no-store");

    const username = escapeHtml(req.session.username);

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Project Prism | Profile</title>
        </head>
        <body>
            <h1>Project Prism</h1>
            <h2>Welcome, ${username}!</h2>
            <p>You are successfully logged in.</p>
            <p>Your username was retrieved from your session.</p>

            <a href="/logout">Logout</a>
        </body>
        </html>
    `);
});

//LOGOUT ENDPOINT:
//Destroy the session when the user clicks Logout
app.get("/logout", (req, res) => {

    req.session.destroy((err) => {
        if (err) {
            console.error("Logout error:", err);
            return res.status(500).send("Logout failed.");
        }

        //Remove the browser's session cookie
        res.clearCookie("connect.sid", { path: "/" });

        //Return to the login page
        res.redirect("/login.html");
    });
});

//Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
