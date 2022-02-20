const $ = (s, e = document.body) => e.querySelector(s);
const $$ = (s, e = document.body) => [...e.querySelectorAll(s)];
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const feedback = $(".feedback");

const WRONG = 0;
const CLOSE = 1;
const CORRECT = 2;
const choices = ['wrong', 'close', 'correct'];

const dom = (tag, attrs, ...children) => {
  const el = document.createElement(tag);
  if (attrs instanceof HTMLElement) {
    children.unshift(attrs);
  } else {
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === "class" && value instanceof Array) {
        value = value.join(" ");
      }
      el.setAttribute(key, value);
    });
  }
  el.append(...children.flat());
  return el;
};

const KEYS = ["QWERTYUIOP", "ASDFGHJKL", "+ZXCVBNM-"];
const PRETTY_KEYS = {
  "+": "Enter",
  "-": "Del",
};
const ROUNDS = 8;
const LENGTH = 5;
const lies = [];

const dictionaryRequest = fetch("/dictionary.txt").then((r) => r.text());
const easyWordsRequest = fetch("/easy-words.txt").then((r) => r.text());
const board = $(".board");
const keyboard = $(".keyboard");

window.onload = () => init().catch((e) => console.error(e));

async function init() {
  const board = generateBoard();
  const kb = generateKeyboard();

  const words = (await dictionaryRequest).split("\n");
  const easyWords = (await easyWordsRequest).split("\n");
  const word = easyWords[(Math.random() * easyWords.length) | 0];

  await startGame({ word, kb, board, words });
}

async function animate(el, name, ms) {
  el.style.animation = `${ms}ms ${name}`;
  await wait(ms * 1.2);
  el.style.animation = "none";
}

async function startGame({ word, kb, board, words }) {
  for (let round = 0; round < ROUNDS; round++) {
    const guess = await collectGuess({ kb, board, round, words });
    const hints = getHints(guess, word);
    
    if (guess.join("") === word) {
      feedback.innerText = `Nice Work!`;
      showLies();
      board.revealHint(round, hints);
      return;
    } else {
      obfuscate(hints);
      board.revealHint(round, hints);
    }
  }
  feedback.innerText = `GAME OVER\nCorrect Answer was: ${word}`;
  showLies();
}

function collectGuess({ kb, board, round, words }) {
  return new Promise((submit) => {
    let letters = [];
    async function keyHandler(key) {
      if (key === "+") {
        if (letters.length === LENGTH) {
          const guessIsValid = words.includes(letters.join(""));
          if (!guessIsValid) {
            feedback.innerText = "Invalid Word";
            await animate($$(".round")[round], "shake", 800);
          } else {
            $(".feedback").innerText = "";
            kb.off(keyHandler);
            submit(letters);
          }
        }
      } else if (key === "-") {
        if (letters.length > 0) {
          letters.pop();
        }
        board.updateGuess(round, letters);
      } else {
        if (letters.length < LENGTH) {
          letters.push(key);
        }
        board.updateGuess(round, letters);
      }
    }
    kb.on(keyHandler);
  });
}

function generateBoard() {
  for (let i = 0; i < ROUNDS; i++) {
    const row = dom("div", {
      class: "round",
      "data-round": i,
    });
    for (let j = 0; j < LENGTH; j++) {
      row.append(
        dom("div", {
          class: "letter",
          "data-pos": j,
        })
      );
    }
    board.append(row);
  }
  return {
    updateGuess: (round, letters) => {
      const blanks = $$(".letter", $$(".round")[round]);
      blanks.forEach((b, i) => (b.innerText = letters[i] || ""));
    },
    revealHint: (round, hints) => {
      const blanks = $$(".letter", $$(".round")[round]);
      hints.forEach((hint, i) => {
        blanks[i].classList.add("letter--hint-" + choices[hint]);
      });
    },
  };
}

function generateKeyboard() {
  keyboard.append(
    ...KEYS.map((row) =>
      dom(
        "div",
        {
          class: "keyboard__row",
        },
        row.split("").map((key) =>
          dom(
            "button",
            {
              class: `key${PRETTY_KEYS[key] ? " key--pretty" : ""}`,
              "data-key": key,
            },
            PRETTY_KEYS[key] || key
          )
        )
      )
    )
  );
  const keyListeners = new Set();
  keyboard.addEventListener("click", (e) => {
    e.preventDefault();
    const key = e.target.getAttribute("data-key");
    if (key) {
      keyListeners.forEach((l) => l(key));
    }
  });
  return {
    on: (l) => keyListeners.add(l),
    off: (l) => keyListeners.delete(l),
  };
}

function obfuscate(hints) {
  const correct = hints.filter(x => x === CORRECT).length;
  let index;
  if (correct === 5) {
    return; // shouldn't happen
  }
  else if (correct === 4) {
    index = (hints.indexOf(WRONG) + 1 + (Math.random() * (LENGTH - 1) | 0)) % LENGTH;
  } else {
    index = Math.random() * LENGTH | 0;
  }
  hints[index] = (hints[index] + 1 + (Math.random() * 2 | 0)) % 3;
  lies.push(index);
}



function getHints(guess, answer) {
   let matched = [];
   let hints = [];
   for (let i = 0; i < LENGTH; i++) {
      if (guess[i] === answer[i]) {
        hints[i] = CORRECT;
      } else {
        hints[i] = WRONG;
        for (let j = 0; j < LENGTH; j++) {
           if (i !== j && guess[i] === answer[j] && guess[j] !== answer[j] && !matched[j]) {
              hints[i] = CLOSE;
              matched[j] = true;
              break;
           }
        }
      }
   }
   return hints; 
}

function showLies() {
  lies.forEach((lie, round) => {
    let blanks = $$(".letter", $$(".round")[round]);
    blanks[lie].classList.add("letter--hint-lie");
  })
}

// Simulate button clicks on the virtual keyboard when physical keys are pressed.
window.addEventListener('keydown', (e) => {
  e.preventDefault();
  let key = e.key;
  if (key === 'Enter') {
    key = '+';
  } else if (key === 'Backspace') {
    key = '-';
  } else if (/[a-zA-Z]/.test(key)) {
    key = key.toUpperCase();
  } else {
    return;
  }
  const keyboardElement = document.querySelectorAll(`[data-key='${key}']`)[0];
  if (keyboardElement) {
    const evt = new MouseEvent("click", {
      view: window,
      bubbles: true,
      cancelable: true,
    });
    keyboardElement.dispatchEvent(evt);
  }
});
