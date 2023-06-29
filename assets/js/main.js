/*----------------
  COSTANTI
-----------------*/
const STORAGE_KEY = "saved_recipes";
const OPENAI = {
  API_KEY: "",
  API_BASE_URL: "https://api.openai.com/v1",
  CHAT_ENDPOINT: "/chat/completions",
  IMAGE_ENDPOINT: "/images/generations",
};
/*----------------
//elementi del DOM
-----------------*/
const loading = document.querySelector(".loading");
const loadingMessage = document.querySelector(".loading-message");
const modal = document.querySelector(".modal");
const modalClose = document.querySelector(".modal-close");
const modalAction = document.querySelector(".modal-action");
//scheremata 'crea'
const tabButtons = document.querySelectorAll(".tab-button");
const ingredients = document.querySelectorAll(".ingredient");
const bowlSlots = document.querySelectorAll(".bowl-slot");
const cookButton = document.getElementById("cook-button");
//schermata 'salvate'
const recipeContent = document.querySelector(".recipe-content");
const recipeImage = document.querySelector(".recipe-image");
const recipeCardTemplate = document.querySelector("#recipe-card-template");
const recipes = document.querySelector(".recipes");

/*----------------
//elementi da riempire
-----------------*/
let bowl = []; //emoji selezionate
let currentRecipe = null; //ricetta ottenuta da GTP o selezionata dallo storage
let savedRecipes = []; //ricette salvate nel localStorage

/*----------------
  INIZIALIZZAZIONE
-----------------*/
//controlla se ci sono ricette in memoria
const storage = localStorage.getItem(STORAGE_KEY);
if (storage) {
  savedRecipes = JSON.parse(storage);
}
//nel caso le renderizza in 'salvate'
renderRecipes();

/*----------------
  EVENT LISTENERS
-----------------*/
//ingredienti
ingredients.forEach(function (element) {
  element.addEventListener("click", function () {
    //fa push dell'emoji nell'array bowl
    addIngredient(element.innerText);
  });
});
//bottone 'crea'
cookButton.addEventListener("click", createRecipe);
//tab per schermata 'crea' o 'salvate'
tabButtons.forEach((element) => {
  element.addEventListener("click", () => {
    //cambia l'attributo nel body con l'attributo del bottone cliccato
    document.body.dataset.activeTab = element.dataset.tab;
  });
});
//icona 'X' che chiude la modale
modalClose.addEventListener("click", closeModal);
//icona a bandiera che aggiunge/rimuove la ricetta dalla memoria
modalAction.addEventListener("click", onModalAction);

/*----------------
  FUNZIONI
-----------------*/
//FUNZIONE CHE INSERISCE L'INGREDIENTE IN ARRAY
function addIngredient(ingredient) {
  //1.non andiamo oltre i tre ingredienti
  const maxSlots = bowlSlots.length;
  if (bowl.length === maxSlots) {
    //elimina l'ingrediente più vecchio
    bowl.shift();
  }
  //2.push dell'ingrediente nel array
  bowl.push(ingredient);
  //3. per ogni slot della bowl renderizziamo l'emoji corrispondente nell'array
  //a. per ogni slot nell'array degli slot
  bowlSlots.forEach(function (slot, index) {
    //b. se nell'array degli ingredienti c'è un elemento con lo stesso indice
    if (bowl[index]) {
      //c. inseriamo l'ingrediente corrispondente nel div-slot
      slot.innerText = bowl[index];
    }
  });
  //4.facciamo comparire il bottone 'crea ricetta'
  if (bowl.length === maxSlots) {
    cookButton.classList.remove("hidden");
  }
}

//FUNZIONE CHE RIPULISCE L'ARRAY DEGLI INGREDIENTI E TOGLIE LE EMOJI DAGLI SLOT
function clearBowl() {
  bowl = [];
  bowlSlots.forEach(function (slot) {
    slot.innerText = "?";
  });
}

//FUNZIONE DI CHIUSURA DELLA MODALE
function closeModal() {
  //1.pulisce array e schermata
  clearBowl();
  //2.nasconde la modale
  modal.classList.add("hidden");
  //3.nasconde il pulsante di salvataggio
  modalAction.classList.add("hidden");
  //4.resetta il pulsante di salvataggio per la prossima ricetta
  modalAction.dataset.action = "save";
  //5.pulisce l'immagine
  recipeImage.innerHTML = "";
  //6.pulisce il testo
  recipeContent.innerHTML = "";
}

//FUNZIONE CHE CONTATTA GPT E CREA LA RICETTA
async function createRecipe() {
  //1.mostra la schermata di caricamento
  loading.classList.remove("hidden");
  //2. intervalla messaggi random ogni 2 sec durante il caricamento
  const interval = setInterval(() => {
    loadingMessage.innerText = getRandomLoadingMessage();
  }, 2000);
  //3a.variabile con il messaggio per GPT in cui inseriamo gli ingredienti dell'array
  const prompt = `\
  Crea una ricetta con questi ingredienti: ${bowl.join(", ")}.
  La ricetta deve essere facile e con un titolo creativo e divertente.
  Le tue risposte sono solo in formato JSON come questo esempio:
  
  ###
  
  {
      "titolo": "Titolo ricetta",
      "ingredienti": "1 uovo e 1 pomodoro",
      "istruzioni": "mescola gli ingredienti e metti in forno"
  }
  
  ###`;
  //3b.Richiediamo a GPT il TESTO della ricetta e ASPETTIAMO la risposta
  const recipeResponse = await makeRequest(OPENAI.CHAT_ENDPOINT, {
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "user", //ruolo (siamo l'utente che fa la domanda)
        content: prompt, //messaggio
      },
    ],
  });
  //3c.l'oggetto ricetta corrente diventa il contenuto della risposta parsata
  currentRecipe = JSON.parse(recipeResponse.choices[0].message.content);
  //4.aggiungiamo all'oggetto la proprietà emoji con gli ingredienti usati per crearlo
  currentRecipe.emoji = bowl.join(" ");
  //5.compiliamo lo spazio della modale con la ricetta ottenuta
  recipeContent.innerHTML = recipeContentHTML(currentRecipe);
  //6a.rimuoviamo la schermata di caricamento
  loading.classList.add("hidden");
  //6b.fermiamo la funzione che cambia i messaggi
  clearInterval(interval);
  //7. MOSTRIAMO la modale
  modal.classList.remove("hidden");
  //8a.Richiediamo a GPT l'IMMAGINE della ricetta e ASPETTIAMO la risposta
  const imageResponse = await makeRequest(OPENAI.IMAGE_ENDPOINT, {
    prompt: currentRecipe.titolo, //creiamo l'immagine a partire dal titolo
    n: 1, //quantità
    size: "512x512", //dimensioni
    response_format: "b64_json", //formato
  });
  //8b. salviamo la risposta
  const imageURL = imageResponse.data[0].b64_json;
  //9. creiamo l'url dell'immagine e lo salviamo come proprietà
  currentRecipe.imageUrl = `data:image/png;base64,${imageURL}`;
  //10.inserimo l'immagine in modale
  recipeImage.innerHTML = recipeImageHTML(currentRecipe);
  //11.mostriamo l'icona per salvare (bandiera)
  modalAction.classList.remove("hidden");
  //puliamo gli ingredienti da array e schermata
  clearBowl();
}

//FUNZIONE CHE COMPILA IL CONTENUTO TESTUALE DELLA MODALE
function recipeContentHTML(recipe) {
  return `\
  <h2>${recipe.titolo}</h2>
  <p>${recipe.ingredienti}</p>
  <p>${recipe.istruzioni}</p>`;
}

//FUNZIONE CHE INSERISCE L'IMMAGINE NELLA MODALE
function recipeImageHTML(recipe) {
  return `<img src="${recipe.imageUrl}" alt ="recipe image">`;
}

//FUNZIONE CHE GESTISCE SALVATAGGIO/RIMOZIONE DELLA RICETTA DALLA MEMORIA
function onModalAction() {
  //1a.se l'attributo dell'icona indica 'salvabile'
  if (modalAction.dataset.action === "save") {
    //1b.salva la ricetta in memoria
    saveRecipe();
    //1c. cambia l'attributo con 'rimuovibile'
    modalAction.dataset.action = "remove";
  } else {
    //2a.rimuovi la ricetta dalla memoria
    removeRecipe();
    //2b.cambia l'attributo in 'salvabile'
    modalAction.dataset.action = "save";
  }
  //3.renderizza le ricette salvate nella relativa schermata
  renderRecipes();
}

//FUNZIONE CHE INSERISCE LA RICETTA NELL'ARRAY DI QUELLE SALVATE E AGGIORNA IL LS
function saveRecipe() {
  //1.comprime l'immagine
  currentRecipe.imageUrl = optimizeBase64Image(0.5);
  //2.fa il push della ricetta nell'array
  savedRecipes.push(currentRecipe);
  //3.aggiorna il localStorage
  updateStorage();
}

//FUNZIONE CHE ELIMINA LA RICETTA DALL'ARRAY DI QUELLE SALVATE E AGGIORNA IL LS
function removeRecipe() {
  //1. determina l'indice della ricetta nell'array
  const index = savedRecipes.indexOf(currentRecipe);
  //2.elimina la ricetta dall'array
  savedRecipes.splice(index, 1);
  //3.aggiorna il localStorage
  updateStorage();
}

//FUNZIONE CHE OTTIMIZZA IL PESO DELL'IMMAGINE RICEVUTA PER IL LS
function optimizeBase64Image(quality) {
  const image = recipeImage.querySelector("img");
  //crea un elemento canva
  const canvas = document.createElement("canvas");
  //con le stesse dimensioni dell'immagine
  canvas.height = image.naturalHeight;
  canvas.width = image.naturalWidth;
  //ritorna un oggetto con metodi per il disegno
  const context = canvas.getContext("2d");
  //in quell'oggetto disegna 'image' a partire dalle coordinate x y (relative a canvas)
  context.drawImage(image, 0, 0);
  //ritorna il contenuto di canvas come immagine utilizzabile nell'attributo src
  return canvas.toDataURL("image/jpeg", quality);
}

//FUNZIONE CHE MOSTRA LE RICETTE SALVATE COME CARD
function renderRecipes() {
  //svuota il container nella sezione 'salvate'
  recipes.innerHTML = "";
  //se l'array delle ricette salvate è vuoto
  if (savedRecipes.length === 0) {
    recipes.innerHTML = "<p>Non hai ancora salvato ricette</p>";
  }
  //per ogni ricetta dell'array
  savedRecipes.forEach((recipe, index) => {
    //crea una card
    const card = recipeCardNode(recipe, index);
    //e la appende
    recipes.appendChild(card);
  });
}

//FUNZIONE CHE CREA LA CARD DELLA RICETTA
function recipeCardNode(recipe, index) {
  //clona il template e ne salva il contenuto principale (tag <article>)
  const card = recipeCardTemplate.content
    .cloneNode(true)
    .querySelector(".recipe-card");
  //attribuisce l'indice della ricetta come attibuto
  card.dataset.index = index;
  //seleziona la sezione foto ed inserisce il tag
  card.querySelector(".thumbnail").innerHTML = recipeImageHTML(recipe);
  card.querySelector(".title").innerText = recipe.titolo;
  card.querySelector(".emoji").innerText = recipe.emoji;
  //la rende cliccabile
  card.addEventListener("click", onRecipeClick);
  //ritorna l'elemento
  return card;
}

//FUNZIONE CHE APRE LA MODALE CON IL CONTENUTO DELLA RICETTA SELEZIONATA
function onRecipeClick(event) {
  //salva l'elemento su cui si è cliccato
  const card = event.currentTarget;
  //seleziona come ricetta corrente quella con lo stesso numero di indice
  currentRecipe = savedRecipes[card.dataset.index];
  //inserisce il testo nella modale
  recipeContent.innerHTML = recipeContentHTML(currentRecipe);
  //inserisce l'immagine nella modale
  recipeImage.innerHTML = recipeImageHTML(currentRecipe);
  //setta la ricetta come 'removibile'
  modalAction.dataset.action = "remove";
  //mostra l'icona a bandiera
  modalAction.classList.remove("hidden");
  //mostra la modale
  modal.classList.remove("hidden");
}

//FUNZIONE CHE AGGIORNA IL LS
function updateStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(savedRecipes));
}

//FUNZIONE CHE ESEGUE UNA RICHIESTA ALL'API DI OPENAI
async function makeRequest(endpoint, payload) {
  //manda un messaggio all'URL (chat/immagine)
  const response = await fetch(OPENAI.API_BASE_URL + endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", //il tipo di messaggio
      Authorization: `Bearer ${OPENAI.API_KEY}`, //la chiave da usare
    },
    body: JSON.stringify(payload), //il messaggio (convertito in JSON)
  });
  //aspetta la risposta e decodifica il JSON
  const json = await response.json();
  //ritorna il risultato
  return json;
}

//FUNZIONE CHE MANDA  UN MESSAGGIO RANDOM DURANTE IL CARICAMENTO
function getRandomLoadingMessage() {
  const messages = [
    "Preparo gli ingredienti...",
    "Scaldo i fornelli...",
    "Mescolo nella ciotola...",
    "Scatto foto per Instagram...",
    "Prendo il mestolo...",
    "Metto il grembiule...",
    "Mi lavo le mani...",
    "Tolgo le bucce...",
    "Pulisco il ripiano...",
  ];
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
}
