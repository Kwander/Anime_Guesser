import express from "express"; //importing express
import axios from "axios"; //importing axios

let app = express(); //setting up express pt 1
let port = 3000; //setting up express pt 2

const GIPHY_API_KEY = "bVgkeHn33QMl2YJVHdojLfEpYmTH1MHp"; 

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

let uniqueAnimeTitles = new Set(); // Create a set to store unique anime titles

async function fetchTopAnime(page) {
    const response = await axios.get("https://api.jikan.moe/v4/top/anime", { //API call to fetch them by popularity
        params: {
            page: page,
            filter: "bypopularity"
        }
    });

    // Filter out sequels and only keep unique titles
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


function delay(ms) { //waits 3.5 seconds
    return new Promise(resolve => setTimeout(resolve, ms));
}

let animeList = [];
let numCorrect = 0; 
let currentAnimeIndex = 0; // Keep track of the current anime
let message = null; // Correct or incorrect


app.get("/", async (req, res) => { // Default page.
    if (numCorrect >= 3) {
        res.redirect('/success'); // Redirect to the success page
    } else {
        try {
            if (animeList.length === 0 || currentAnimeIndex >= animeList.length) {
                res.render("intro.ejs", {});

                // Fetch new data if there's no data or if we've gone through all the animes
                //Will Update animeList with the top 100 animes upon loading.
                for (let page = 1; page <= 4; page++) { // Fetch 4 pages of anime, 25 per page
                  const animePage = await fetchTopAnime(page);
                  animeList = animeList.concat(animePage);
                  await delay(3500); // Wait for 3.5 seconds between requests
                }
                currentAnimeIndex = 0;
              }
            
              const anime = animeList[currentAnimeIndex]; // Get the first anime in the combined list
            // Search for a GIF related to the anime title
    
              const gifUrl = await searchAnimeGif(anime.title);
            //renders the title, title in english, synposis, and url.
    
              res.render("index.ejs", {
                title: anime.title,
                title_english: anime.title_english,
                synopsis: anime.synopsis,
                url: anime.url,
                imageUrl: anime.images.jpg.image_url,
                gifUrl: gifUrl,
                currCorrect: numCorrect,
                message: message // Pass the message to the template
              });
              message = null; // Clear the message after rendering
    
        } catch (error) {
            console.log(error.response ? error.response.data : error.message);
            res.status(500).send("Error fetching anime data");
        }
    }
});

// Create a new route for the success page
app.get('/success', (req, res) => {
    res.render('congrats.ejs'); // Render the success page
});


//makes guessing titles easier
function removeNonAlphabetical(str) {
    return str.replace(/[^a-z]/gi, '').toLowerCase();
}
function takeFirstPartofTitle(str) {
    str = str.split(':')[0]; // Keep everything before the colon
    return str.replace(/[^a-z]/gi, '').toLowerCase();
}
  
app.post("/guess", async (req, res) => {
    const userGuess = removeNonAlphabetical(req.body.guess);

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
        message = "Sorry, that's not correct. Try again!";
    }

    res.redirect("/");
});



app.listen(port, () => { //setting up express pt 3
    console.log(`Server is running on port ${port}`);
});
