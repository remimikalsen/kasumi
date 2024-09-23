# Kasumi Project

Welcome to the Kasumi Project! This README will guide you through the setup and usage of the project.

## Table of Contents
- [Introduction](#introduction)
- [Featuring games](#featuring games)
- [Installation](#installation)
- [Configuration](#configuration)
- [Translations](#translations)
- [License](#license)

## Introduction
Kasumi is a project designed to introduce my kids to programming - and show them how a computer game can be made. Currently, Kasumi iw a simple, multi-lingual web page, that consists of a front page and two games, DogRun and PacMaze. Each game has their own high score system.

DogRun and PacMaze are both featured on the front page, with the currently highest score also featured along with a screenshot of each game.

## Featuring games
- DogRun: Save the dog from the dog catchers, avoid holes and collect bones on the way to its home.
- PacMaze: Guide the scared kid through the maze, away from the ghosts and safely to its home.

## Installation
Docker with docker compose are pre-requirements.

To install and set up the project, follow these steps:

1. Clone the repository:
    ```bash
    git clone https://github.com/remimikalsen/kasumi.git
    ```
2. Navigate to the project directory:
    ```bash
    cd kasumi
    ```
3. Run it:
    ```bash
    docker compose up -d
    ```

The Kasumi web page is now available on localhost:8080.


## Configuration
Not much needed in this area; except what languages you want available in the front-end, and what language is the default. And you may want to run the back-end server somewhere else. In these cases, just alter the default docker-compose.yml.

You may also change the ports you expose; if for example your port 8080 is taken. It's simply a matter of adjusting the docker-compose.yml file.


## Translations
The project features three languages; Norwegian, English and Portuguese. Translations are located under /src/lib/translations. Adding another language is a matter of copying language files form an existing language and adding the language to the list of available languages in docker-compose.


## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
