import express from "express";
import axios from "axios"; 

let app = express(); 
let port = 3000; 

const GIPHY_API_KEY = "bVgkeHn33QMl2YJVHdojLfEpYmTH1MHp";   // Giphy API key. Can only do 100 Req per Hour ;_;

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

/*This set and function fetchTopAnime will use an API call to jikan to fetch the top 100 anime. and Will then filter them using this set. Since in the top 100 anime there are also sequels like attack on titan Season 2 part 3 etc. Also adds anime before the colon for easier guessing.*/
let uniqueAnimeTitles = new Set(); 

async function fetchTopAnime(page) {
    const response = await axios.get("https://api.jikan.moe/v4/top/anime", { 
        params: {
            page: page,
            filter: "bypopularity"
        }
    });

    const uniqueAnimes = response.data.data.filter(anime => {
        let title = anime.title.split(':')[0].trim(); // Keep everything before the colon
        title = title.replace(/ season \d+/i, ''); // Remove 'season' followed by a number
        title = title.replace(/ \d+(st|nd|rd|th) season/i, ''); // Remove '1st', '2nd', '3rd', '4th', etc. followed by 'season'
        title = title.replace(/ season \d+ part \d+/i, ''); // Remove 'season' followed by a number and 'part' followed by a number
        if (!uniqueAnimeTitles.has(title)) {
            uniqueAnimeTitles.add(title);
            return true;
        }
        return false;
    });

    return uniqueAnimes;
}


/**searches using Giphy API and key. For an image next to my page. only 100 per hour*/
async function searchAnimeGif(query) {
    const response = await axios.get("https://api.giphy.com/v1/gifs/search", {
        params: {
            api_key: GIPHY_API_KEY,
            q: query,
            limit: 1 // Limit to one GIF for simplicity
        }
    });
    const gifUrl = response.data.data.length > 0 ? response.data.data[0].images.original.url : null;
    return gifUrl;
}

/**Can only fetch 25 anime and then must wait 3 seconds. So this will wait 3.5 seconds on its own*/
function delay(ms) { 
    return new Promise(resolve => setTimeout(resolve, ms));
}

let animeList = [];
let numCorrect = 0; 
let currentAnimeIndex = 0; // Keep track of the current anime
let message = null; // Correct or incorrect

/* * First run it will Render Show the intro page with instructions and fetch the top 100 most popular anime.
* renders anime promo art(from anime json from jikan) and generated giphy from giphy using anime.title */
app.get("/", async (req, res) => { // Default page.
    if (numCorrect >= 50) {
        res.redirect('/success'); // Redirect to the success page
    } else {
        try {
            if (animeList.length === 0 || currentAnimeIndex >= animeList.length) {
                res.render("intro.ejs", {});

                for (let page = 1; page <= 4; page++) { // Fetch 4 pages of anime, 25 per page
                    const animePage = await fetchTopAnime(page);
                    animeList = animeList.concat(animePage);
                    await delay(3500); // Wait for 3.5 seconds between requests
                }
            }
            
            const anime = animeList[currentAnimeIndex]; 

            const gifUrl = await searchAnimeGif(anime.title + "anime");
            // const gifUrl = ""; Using this one once I ran out of API requests

            res.render("index.ejs", {
                url: anime.url,
                imageUrl: anime.images.jpg.image_url,
                gifUrl: gifUrl,
                currCorrect: numCorrect,
                message: message 
            });
            message = null; // Clear the message after rendering

        } catch (error) {
            console.log(error.response ? error.response.data : error.message);
            res.status(500).send("Error fetching anime data");
        }
    }
});

/**win condition Cute page*/
app.get('/success', (req, res) => {
    res.render('congrats.ejs'); // Render the success page
});

//makes guessing titles easier
function removeNonAlphabetical(str) {
    return str.replace(/[^a-z]/gi, '').toLowerCase();
}
function takeFirstPartofTitle(str) {
    str = str.split(':')[0]; // Keep everything before the colon. Noticed I needed this for "Demon Slayer: Kimetsu no yaiba". Everyone just calls it demon slayer so it should take it.
    return str.replace(/[^a-z]/gi, '').toLowerCase();
}
/**Must make sure you can input titles in japanese as abbreviations, as first parts of the title(before colon), and all the synonyms included in the package */
app.post("/guess", async (req, res) => {
    const userGuess = removeNonAlphabetical(req.body.guess);

    // Check if the user's guess is an empty string
    if (userGuess === "") {
        message = "Please enter a guess.";
        res.redirect("/");
        return;
    }

    const currentAnime = animeList[currentAnimeIndex];
    const title = removeNonAlphabetical(currentAnime.title);
    const titleEnglish = removeNonAlphabetical(currentAnime.title_english);
    const titleJapanese = removeNonAlphabetical(currentAnime.title_japanese);
    const titleFirstPart = takeFirstPartofTitle(currentAnime.title_english);
    const titleSynonyms = currentAnime.title_synonyms.map(removeNonAlphabetical);

    if (userGuess === title || userGuess === titleEnglish || userGuess === titleJapanese || userGuess === titleFirstPart || titleSynonyms.includes(userGuess)) {
        numCorrect++;
        currentAnimeIndex++;
    } else {
        console.log("english:", titleEnglish, "\njapanese: " , titleJapanese, "\nsynonyms", titleSynonyms, "\ntakefirstpart: ", titleFirstPart);
        message = "Sorry, that's not correct. Try again! (if you give up click on the left image)";
    }

    res.redirect("/");
});



app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
