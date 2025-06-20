# p5.js Snooker Game

A 2D snooker game built with p5.js and the Matter.js physics engine. This project is a browser-based simulation of snooker, featuring realistic physics, scoring, foul detection, and game state management.

### [▶ Play the Game Live!](https://huzaifakhallid.github.io/snooker_p5.js/)

---

## Features

- **Realistic Physics:** Uses the Matter.js engine for accurate ball collisions, friction, and cushion bounces.
- **Complete Game Loop:** Full game state management for aiming, shooting, waiting for balls to stop, and placing the cue ball after a foul.
- **Snooker Rules & Scoring:**
  - Dynamic scoring based on the value of potted balls.
  - Foul detection for hitting the wrong ball, potting the cue ball, or potting an incorrect color.
  - Correctly alternates between targeting reds and colors.
- **Interactive UI:** Displays the current score, a game timer, the current target ball, and power/chalk meters.
- **Cue Controls:**
  - Intuitive mouse-based aiming and power control.
  - A "chalk" feature (`C` key) to enable more powerful shots and prevent miscues.
- **Sound Effects:** Audio feedback for ball collisions, pots, and cue actions.

## How to Play

- **Aim:** Move the mouse around the cue ball.
- **Set Power & Shoot:** Click and drag the mouse away from the cue ball to set the shot power. Release the mouse button to shoot.
- **Chalk Cue:** Before a shot, press the **`C`** key to "chalk" the cue. This allows for a more powerful shot without a miscue.
- **Reset Game:**
  - **`1`**: Reset to a standard game start.
  - **`2`**: Reset with reds in random positions.
  - **`3`**: Reset with all balls in random positions.

## Technologies Used

- **[p5.js](https://p5js.org/):** For canvas rendering, drawing, and user interaction (mouse, keyboard).
- **[Matter.js](https://brm.io/matter-js/):** For the 2D physics engine.
- **HTML5 & JavaScript:** The core technologies for running in the browser.

## Local Development

To run this project on your local machine:

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/huzaifakhallid/snooker_p5.js.git
    ```
2.  **Navigate to the directory:**
    ```sh
    cd snooker_p5.js
    ```
3.  **Run a local server:**
    Open the `index.html` file using a live server extension (like "Live Server" in VS Code). This is necessary to avoid browser security (CORS) errors when loading the sound files.
