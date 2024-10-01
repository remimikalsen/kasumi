    <script>
        import { onMount, tick, onDestroy } from 'svelte';
        import { bonesCollected, bonesCollectedLevel, currentLevel, bonus, lives } from '$lib/stores/dogRun.js';
        import { getLocalizedText, loadTexts, activeLanguage } from '$lib/stores/translatedTexts.js';
        import { levels } from '$lib/config/dogRunLevels.js'; 
        import Dog from '$lib/components/dogrun/Dog.svelte'; 
        import Goal from '$lib/components/dogrun/Goal.svelte';
        import Ground from '$lib/components/dogrun/Ground.svelte';
        import Spike from '$lib/components/dogrun/Spike.svelte';
        import Platform from '$lib/components/dogrun/Platform.svelte';
        import Hole from '$lib/components/dogrun/Hole.svelte';
        import Bone from '$lib/components/dogrun/Bone.svelte'; 
        import Message from '$lib/components/common/Message.svelte';
        import VirtualKeyboard from '$lib/components/common/VirtualKeyboard.svelte';
        import VirtualJoystick from '@lib/components/common/VirtualJoystickArcade.svelte';
        import { env } from '$env/dynamic/public';
        
        let showNextLevelMessage = false;
        let showCongratulations = false;
        let showErrorMessage = false;
        let showGameOverMessage = false;
        let showVirtualKeyboard = false;
        let showFailureMessage = false;
        let showBonusAnimation = false;
        let winnerFound = false;
        let pulsateScore = false;
        let pulsateFail = false;
        let hasStarted = false;
        let lastClick;
        let lastTap;


        let gameContainer; // Reference to the game container
        
        let pressedKeys = new Set();
        let lastDirection = null; // Track the last direction pressed        

        let gameOver;
        let inHole;
        let reachedGoal;
        let velocityY;
        let speed;
        let cameraOffsetX;
        let dogSpeed;
        let jumping;
        let directionChanged;
        let screenWidth;
        let groundHeight;

        let gravity = 0.5;
        let defaultSpeed = 2;
        const gameContainerHeight = 400;
        let groundAdjustment = 2;

        const initialLives = 3;
        //let lives;
        const lifeBonus = 2; // Bonus per life remaining at end of game
        let dog = {};
        let goal = {};
        let platforms = [];
        let holes = [];
        let spikes = [];
        let bones = [];
        
        let dogState = 'normal';
        let currentMessage = '';
        let gamePaused = false;

        let leaderboard = [];
        let playerInitials = '';

        let pausedOverlay;
        let startOverlay;
        let winnerOverlay;
        let bonusOverlay;
        let gameWrapper;

        const pageTexts = 'dogrun';
        //const commonTexts = 'common';
        let isLoadingTexts = true;

        let instructionsVisible = false;

        $: gameStopped = !hasStarted || showFailureMessage || showNextLevelMessage || showCongratulations || showErrorMessage || showGameOverMessage || winnerFound || isLoadingTexts;

        $: if (hasStarted) {
            // If the game is active, focus on the gameContainer and calculate the width
            tick().then(() => {
                if (gameContainer) {
                    gameContainer.focus();
                    screenWidth = gameContainer.clientWidth;
                    //console.log("Screen width: ", screenWidth);
                }
            });
        }

        async function fetchTexts() {
            isLoadingTexts = true;
            await loadTexts(pageTexts);
            //await loadTexts(commonTexts);
            isLoadingTexts = false;
        }
        $: $activeLanguage, fetchTexts();

        $: if (gameWrapper && gameContainer && startOverlay) {   
            gameContainer.addEventListener('touchend', handleDoubleTap);
            gameContainer.addEventListener('mousedown', handleDoubleClick);
            updateOverlayPositions();
        }

        onMount(() => {

            fetchTexts();
            generateLevel($currentLevel);
            loadLeaderboard();  // Load the leaderboard when the component is mounted
            lives.set(initialLives);
            bonus.set($lives * lifeBonus);
            // Automatically focus the game container when the component is mounted
            //gameContainer.focus();
            
            window.addEventListener('keydown', handleShortcutKeyDown);
            window.addEventListener('resize', updateOverlayPositions);
            document.addEventListener('visibilitychange', handleVisibilityChange);
            const gameLoop = setInterval(() => {
                if (!gameOver && !gamePaused) {
                    update();
                }
            }, 10);
            return () => {
                clearInterval(gameLoop);
                window.removeEventListener('keydown', handleShortcutKeyDown);
                window.removeEventListener('resize', updateOverlayPositions);
            }
        });


        onDestroy(() => {
            window.removeEventListener('keydown', handleShortcutKeyDown);
            window.removeEventListener('resize', updateOverlayPositions);

            gameContainer.removeEventListener('touchend', handleDoubleTap);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('touchmove', preventScroll, { passive: false });
            gameContainer.removeEventListener('mousedown', handleDoubleClick);
            document.body.classList.remove('no-scroll');
        });

        async function handleSubmitInitials(initials) {
            playerInitials = initials;
            await storeScore(playerInitials, $bonesCollected);  // Store the score in the database
            await loadLeaderboard();  // Load the updated leaderboard after the score is stored
            showVirtualKeyboard = false;
            showCongratulations = false;
            hasStarted = false;
        }

        async function storeScore(initials, bones) {
            await fetch('/api/dogrun/submit_score', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.PUBLIC_API_KEY}`
            },
            body: JSON.stringify({ initials, bones })
            });
        }        

        function triggerPulsateScore() {
            pulsateScore = true;
            setTimeout(() => {
                pulsateScore = false;
            }, 500); // Duration of the animation
        }        

        function triggerPulsateFail() {
            pulsateFail = true;
            setTimeout(() => {
                pulsateFail = false;
            }, 500); // Duration of the animation
        }        


        async function fetchLeaderboard() {
            const response = await fetch('/api/dogrun/get_leaderboard', {
                headers: {
                    'Authorization': `Bearer ${env.PUBLIC_API_KEY}`
                }
            });
            return await response.json();
        }


        async function loadLeaderboard() {
            const data = await fetchLeaderboard();

            if (Array.isArray(data) && data.length > 0) {
                leaderboard = [...data];
            }
        }

        function startGame() {
            hasStarted = true;
            startOver();
        }

        function startOver() {
            $currentLevel = 1; 
            bonesCollected.set(0);
            bonesCollectedLevel.set(0);
            lives.set(initialLives);
            bonus.set($lives * lifeBonus);
            winnerFound = false;
            gamePaused = false;
            showCongratulations = false;
            showVirtualKeyboard = false;
            generateLevel($currentLevel);
            scrollAndFreeze();
            gameContainer.focus();
        }

        function nextLevel() {
            currentLevel.update(n => n + 1); 
            generateLevel($currentLevel);
            scrollAndFreeze();
            gameContainer.focus();
        }

        function togglePause() {
            pressedKeys = new Set();
            gamePaused = !gamePaused;

            if (!gamePaused) {
                scrollAndFreeze();
            } else {
                document.body.classList.remove('no-scroll');
                window.removeEventListener('touchmove', preventScroll, { passive: false });
            }

            gameContainer.focus();            
        }

        function toggleInstructions() {
            instructionsVisible = !instructionsVisible;
        }        


        function updateOverlayPositions() {
            
            //console.log(gamePaused);
            //console.log(gameWrapper);
            //console.log(pausedOverlay); 
            if (gameWrapper && pausedOverlay) {
                //console.log("Updating overlay position");
                const rect = gameWrapper.getBoundingClientRect();
                pausedOverlay.style.top = `${rect.top + window.scrollY-20}px`;
                pausedOverlay.style.left = `${rect.left + window.scrollX-20}px`;
                pausedOverlay.style.width = `${rect.width+40}px`;
                pausedOverlay.style.height = `${rect.height+40}px`;
            }

            if (gameWrapper && bonusOverlay) {
                //console.log("Updating overlay position");
                const rect = gameWrapper.getBoundingClientRect();
                bonusOverlay.style.top = `${rect.top + window.scrollY}px`;
                bonusOverlay.style.left = `${rect.left + window.scrollX}px`;
                bonusOverlay.style.width = `${rect.width}px`;
                bonusOverlay.style.height = `${rect.height}px`;
            }
            let addedBorders = 0;
            
            if (gameWrapper && startOverlay) {  
              const rect = gameWrapper.getBoundingClientRect();
              startOverlay.style.top = `${rect.top + window.scrollY - addedBorders}px`;
              startOverlay.style.left = `${rect.left + window.scrollX - addedBorders}px`;
              startOverlay.style.width = `${rect.width + addedBorders*2}px`;
              startOverlay.style.height = `${rect.height + addedBorders*2}px`;
          }            

          if (gameWrapper && winnerOverlay) {
              const rect = gameWrapper.getBoundingClientRect();
              winnerOverlay.style.top = `${rect.top + window.scrollY - addedBorders}px`;
              winnerOverlay.style.left = `${rect.left + window.scrollX - addedBorders}px`;
              winnerOverlay.style.width = `${rect.width + addedBorders*2}px`;
              winnerOverlay.style.height = `${rect.height + addedBorders*2}px`;
          }            

        }        

        function generateLevel(level) {
            if (level < 1 || level > levels.length) {
                showErrorMessage = true;
                currentMessage = `Invalid current level: ${level}`;
            }

            const levelData = levels[level - 1];
            inHole = false;

            if (!levelData) {
                showErrorMessage = true;
                currentMessage = `Level data is undefined for level: ${level}`;
            }

            pressedKeys = new Set();
            lastDirection = null; // Track the last direction pressed

            groundHeight = gameContainerHeight - levelData.groundHeight;
            
            platforms = levelData.platforms.map(platform => ({
                ...platform,
                y: groundHeight - platform.y,
            }));
            
            holes = levelData.holes.map(hole => ({
                ...hole,
                y: groundHeight,
            }));

            spikes = levelData.spikes.map(spike => ({
                ...spike,
                y: groundHeight - spike.y - spike.height,
            }));
            
            bones = levelData.bones.map(bone => ({
                ...bone,
                y: groundHeight - bone.y - bone.height,
            }));
            
            dog = { ...levelData.dog };
            // Adjust the dog's y to be relative to the ground height
            dog.y = groundHeight - dog.y;
            
            goal = { ...levelData.goal };
            // Adjust the goal's y to match the ground height
            goal.y = groundHeight - goal.y;
            
            velocityY = 0;
            cameraOffsetX = 0;
            dogSpeed = 0;
            speed = defaultSpeed;
            reachedGoal = false;
            gameOver = false;
            jumping = false;
            directionChanged = false;
            showNextLevelMessage = false;
            showCongratulations = false;
            showErrorMessage = false;
            showGameOverMessage = false;
            showVirtualKeyboard = false;
            showFailureMessage = false;
        }

        function update() {
            
            if (gameStopped) {
                return;
            }

            //killswitch = true;
            velocityY += gravity;
            dog.y += velocityY;
            
            // Determine the dog's state based on velocity and direction
            
            if (velocityY < gravity) {
                if (dogSpeed < 0) {
                    dogState = 'jumping-left';
                } else {
                    dogState = 'jumping-right';
                }
            } else if (velocityY > gravity) {
                if (dogSpeed < 0) {
                    dogState = 'landing-left';
                } else {
                    dogState = 'landing-right';
                }
            } else if (dogSpeed < 0) {
                dogState = 'turning-left';
            } else {
                 dogState = 'turning-right';
            }
            
            
            if (goal.x - cameraOffsetX + goal.width <= 0) {
                gameOver = true;
                handleGameOver();
            } else if (goal.x - cameraOffsetX <= screenWidth - goal.width) {
                reachedGoal = true;
                //speed = 1; // Reduced speed to make the game feel more continuous when goal is in sight
                cameraOffsetX += speed;
            } else {
                cameraOffsetX += speed;
            }
            
            dog.x += dogSpeed;

            if (dog.x < 0) dog.x = 0;
            if (dog.x > screenWidth - dog.width) dog.x = screenWidth - dog.width;

            let onGround = false;

            platforms.forEach(platform => {
                if (dog.x + dog.width > platform.x - cameraOffsetX && dog.x < platform.x + platform.width - cameraOffsetX) {
                    if (dog.y + dog.height > platform.y && dog.y + dog.height < platform.y + platform.height + 10 && velocityY > 0) {
                        dog.y = platform.y - dog.height;
                        velocityY = 0;
                        onGround = true;
                        jumping = false;
                        directionChanged = false;
                    }
                }
            });

            holes.forEach(hole => {
                if (inHole || (dog.x + (dog.width/2) > hole.x - cameraOffsetX && dog.x + dog.width < hole.x + hole.width - cameraOffsetX)) {
                    //console.log("Above hole" + hole.x);
                    //console.log("Dog: " + (dog.y + dog.height));
                    //console.log("Hole:" + (hole.y+groundAdjustment));
                    if (dog.y + dog.height + 1 > (hole.y+groundAdjustment)) {
                        //console.log("In hole");
                        //velocityY = 0;
                        onGround = false;
                        inHole = true;
                        jumping = false;
                        directionChanged = false;
                    }
                }
            });

            if (!inHole && !onGround && dog.y + dog.height >= groundHeight - groundAdjustment) {
                dog.y = groundHeight - dog.height + groundAdjustment;
                velocityY = 0;
                jumping = false;
                directionChanged = false;
            }

            spikes.forEach(spike => {
                if (checkCollision(dog, { ...spike, x: spike.x - cameraOffsetX })) {
                    gameOver = true;
                    handleGameOver();
                }
            });

            bones = bones.filter(bone => {
                if (checkCollision(dog, { ...bone, x: bone.x - cameraOffsetX })) {
                    bonesCollectedLevel.update(n => n + 1); // Update the bone count directly
                    triggerPulsateScore();
                    return false;
                }
                return true;
            });

            if (checkCollision({ ...dog, x: dog.x + cameraOffsetX }, goal)) {
                reachedGoal = true;
                speed = 0;
                handleLevelCompletion();
            }

            //if (dog.y + dog.height > (groundHeight + groundAdjustment)) {
            if (dog.y + dog.height > gameContainerHeight) {
                gameOver = true;
                handleGameOver();
            }
        }

        function checkCollision(rect1, rect2) {
            return (
                (rect1.x + rect1.collisionTolerance) < rect2.x + rect2.width &&
                (rect1.x - rect1.collisionTolerance) + rect1.width > rect2.x &&
                (rect1.y + rect1.collisionTolerance) < rect2.y + rect2.height &&
                (rect1.y - rect1.collisionTolerance) + rect1.height > rect2.y
            );
        }

        function handleShortcutKeyDown(event) {
            if (event.key === 'p' && !gameStopped) {
                togglePause();
            } else if (event.key === 't' && showFailureMessage) {
                acknowledgeFailure();
            } else if (event.key === 'r') {
                startOver();
            } else if (event.key === 'n' && showNextLevelMessage) {
                nextLevel();
            }
        }

        function handleKeyDown(event) {
            
            if ((gameStopped) && (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === ' ')) {
                event.preventDefault();
                return;
            }

            if (event.key === 'ArrowDown') {
                // Prevent default action for ArrowUp and ArrowDown keys
                event.preventDefault();
                return;
            }            

            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === ' ' || event.key === 'ArrowUp') {
                pressedKeys.add(event.key);
                event.preventDefault();
            }

            if (event.key === 'ArrowRight') {
                dogSpeed = 5;
                lastDirection = 'right';
            } else if (event.key === 'ArrowLeft') {
                dogSpeed = -5;
                lastDirection = 'left';
            } else if (event.key === ' ' || event.key === 'ArrowUp') {
                jump();
            }
        }

        function handleKeyUp(event) {
            pressedKeys.delete(event.key);

            if (!pressedKeys.has('ArrowRight') && !pressedKeys.has('ArrowLeft')) {
                dogSpeed = 0;
            } else if (pressedKeys.has('ArrowRight')) {
                dogSpeed = 5;
                lastDirection = 'right';
            } else if (pressedKeys.has('ArrowLeft')) {
                dogSpeed = -5;
                lastDirection = 'left';
            }
        }

        function jump() {
            if (dog.y + dog.height >= groundHeight || platforms.some(p => dog.y + dog.height == p.y)) {
                velocityY = -12;
                jumping = true;
                directionChanged = false;
            }
        }

        function handleVirtualKey(event) {
            const { type, key } = event.detail;
            switch (key) {
                case 'ArrowUp':
                    if (type === 'pressed') {
                        jump();
                    }
                    break;
                case 'ArrowLeft':
                    if (type === 'pressed') {
                        dogSpeed = -5;
                    } else if (type === 'released') {
                        dogSpeed = 0;
                    }
                    break;
                case 'ArrowRight':
                    if (type === 'pressed') {
                        dogSpeed = 5;
                    } else if (type === 'released') {
                        dogSpeed = 0;
                    }
                    break;
            }
        }

        async function handleLevelCompletion() {
            updateOverlayPositions();

            if (gameStopped) {
                return;
            }
            //console.log("Bones collected level: ", $bonesCollectedLevel);
            //console.log("Bones collected: ", $bonesCollected);

            bonesCollected.update(n => n + $bonesCollectedLevel);
            bonesCollectedLevel.set(0);

            if ($currentLevel < levels.length) {
                showNextLevelMessage = true;
                currentMessage = getLocalizedText(pageTexts, "level_complete").replace("<LEVEL>", $currentLevel).replace("<LEVELS>", levels.length);
            } else {
                winnerFound = true;
                if ($bonus > 0) {
                    showBonusAnimation = true;
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for the bonus animation to complete
                    //console.log("Bonus: ", $bonus);
                    const transferBonus = setInterval(() => {
                        if ($bonus > 0) {
                            bonus.update(n => n - 1);
                            bonesCollected.update(n => n + 1);
                        } else {
                            clearInterval(transferBonus);
                        }                    
                    }, 100);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for the added bones to complete
                    triggerPulsateScore();
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for the pulsate animation to complete
                    showBonusAnimation = false;
                    showCongratulations = true;
                    showVirtualKeyboard = true;
                    currentMessage = getLocalizedText(pageTexts, "game_complete_with_bonus")
                        .replace("<BONES>", $bonesCollected)
                        .replace("<BONE_TEXT>", getLocalizedText(pageTexts, $bonesCollected === 1 ? "bone_singular" : "bone_plural"));
                } else {
                    showCongratulations = true;
                    showVirtualKeyboard = true;
                    currentMessage = getLocalizedText(pageTexts, "game_complete_without_bonus")
                        .replace("<BONES>", $bonesCollected)
                        .replace("<BONE_TEXT>", getLocalizedText(pageTexts, $bonesCollected === 1 ? "bone_singular" : "bone_plural"));
                }

                gameWrapper.style.paddingTop = "unset";
                gameWrapper.style.paddingBottom = "unset";
                gameWrapper.height = "unset";      
                document.body.classList.remove('no-scroll');
                updateOverlayPositions();
                window.removeEventListener('touchmove', preventScroll, { passive: false });
            }
        }

        function acknowledgeFailure() {
            showFailureMessage = false;
            generateLevel($currentLevel);
            scrollAndFreeze();
            gameContainer.focus();
        }

        // Function to wait for the bonus animation to complete
        function waitForAnimation() {
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve();
                }, 2000); // Duration of the bonus animation
            });
        }

        async function handleGameOver() {

            if (gameStopped) {
                return;
            }   

            if ($lives > 1) {
                showFailureMessage = true;
                lives.update(n => n - 1); 
                bonus.set($lives * lifeBonus);

                if ($bonesCollectedLevel > 0) {

                    const interval = setInterval(() => {
                        bonesCollectedLevel.update(n => n - 1);   
                        if ($bonesCollectedLevel <= 0) {
                            clearInterval(interval);
                        }
                    }, 200);

                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for the added bones to complete
                    triggerPulsateFail();
                }                
            } else {
                showGameOverMessage = true;

                document.body.classList.remove('no-scroll');
                updateOverlayPositions();
                window.removeEventListener('touchmove', preventScroll, { passive: false });
                gameWrapper.scrollIntoView({ behavior: 'smooth' });


                $currentLevel = 1;
                bonesCollected.set(0);
                bonesCollectedLevel.set(0);
            }
        }    



    async function scrollAndFreeze() {
    //updateDimensions();

    if (window.innerWidth <= 800) { // Adjust the width threshold as needed

        gameWrapper.height = Array.from(gameWrapper.children).reduce((totalHeight, child) => {
          const style = window.getComputedStyle(child);
          const marginTop = parseFloat(style.marginTop);
          const marginBottom = parseFloat(style.marginBottom);
          return totalHeight + child.offsetHeight + marginTop + marginBottom;
        }, 0);
        let pad = (window.innerHeight - gameWrapper.height)/2;
        gameWrapper.style.paddingTop = pad+'px';
        gameWrapper.style.paddingBottom = pad+'px';

        gameWrapper.scrollIntoView({ behavior: 'smooth' });
        await waitForScrollToEnd();
        document.body.classList.add('no-scroll');
        window.addEventListener('touchmove', preventScroll, { passive: false });
    } else {
      gameWrapper.style.paddingTop = "unset";
      gameWrapper.style.paddingBottom = "unset";
      gameWrapper.height = "unset";      
      document.body.classList.remove('no-scroll');
      updateOverlayPositions();
      window.removeEventListener('touchmove', preventScroll, { passive: false });
    }
  }


  function waitForScrollToEnd() {
    return new Promise((resolve) => {
      let isScrolling;
      const onScroll = () => {
        window.clearTimeout(isScrolling);
        isScrolling = setTimeout(() => {
          window.removeEventListener('scroll', onScroll);
          resolve();
        }, 100); // Adjust the timeout as needed
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    });
  }


  const preventScroll = (e) => {
    e.preventDefault();
  };  
    
  function handleDoubleTap(event) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;

    if (tapLength < 300 && tapLength > 0) {
      togglePause();
    }
    lastTap = currentTime;
  } 

  function handleDoubleClick(event) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastClick;

    if (tapLength < 300 && tapLength > 0) {
      togglePause();
    }
    lastClick = currentTime;
  } 


  function handleVisibilityChange() {
      if (document.hidden) {
          if (!gamePaused) {
          togglePause();
          }
      }
  }  


    </script>

    <style>

        .container {
            display: flex;
            justify-content: center;
            align-items: stretch;
            width: 100%;
            height: 100%;
        }

        .game-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin-top: 20px;
            width: 100%;
            outline: none;
        }

        .blur {
            filter: blur(10px);
            z-index: 1;
        }        
        .game-container,
        .game-info {
            width: 100%;
            max-width: 900px;
            min-width: 900px;
            height: 400px;
            border: none;
            box-shadow: 0 6px 10px rgba(0, 0, 0, 0.2);
            position: relative;
            overflow: hidden;
            background-color: skyblue;
            outline: none;
        }
        
        .left-column,
        .right-column {
            flex: 0 1 auto; 
            display: flex;
            flex-direction: column; /* Stack content vertically */
            /*justify-content: center;*/ /* Center content vertically */
            align-items: center; /* Center content horizontally */
            padding: 20px;
        }

        .right-column {
            min-width: 350px;
            padding-top: 22px;
        }

        .left-column,
        .right-column {
            padding: 20px;
        }

        .button-container {
            margin-top: 50px;
            margin-bottom: 30px;
        }

        .reset-button,
        .pause-button {
        background-color: #ca3049;
        color: #e0e1dd;
        padding: 12px 24px;
        font-size: 1.2rem;
        font-weight: bold;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        box-shadow: 0 6px 10px rgba(0, 0, 0, 0.2);
        transition: all 0.3s ease;
        text-transform: uppercase;
        margin-left: 15px;
        margin-right: 15px;
        letter-spacing: 1px;
        user-select: none;  /* Prevent text selection */
        -webkit-user-select: none;
        -ms-user-select: none;
        -moz-user-select: none;
        }

        .pause-button {
            background-color: #f0b300;
            color: #1b263b;
            width: 170px;
        }
        .reset-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 15px rgba(0, 0, 0, 0.3);
        }

        .reset-button:active {
        transform: translateY(2px);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
        background-color: #f0b300;
        }

        .leaderboard {
        padding: 10px;
        background-color: #1b263b;
        color: #e0e1dd;
        border-radius: 5px;
        border-style: solid;
        border-color: #f05972;
        border-width: 2px;
        box-shadow: 0 0px 12px rgba(237, 74, 213, 0.6);
        width: 300px;
        margin: 20px auto;
        }

        .leaderboard h2 {
            color: #f05972;
        }

        .leaderboard table {
        width: 100%;
        border-collapse: collapse;  
        }

        .leaderboard th, .leaderboard td {
        padding: 5px;
        text-align: left;
        }

        .leaderboard th {
        border-bottom: 2px solid #e0e1dd;
        }

        .leaderboard tr:first-child td {
        color: #ffd700; /* Golden color */
        text-shadow: 
            0 0 5px #ffd700,  /* Inner glow */
            0 0 10px #ffd700, /* Slightly outer glow */
            0 0 20px #ffd700, /* Further outer glow */
            0 0 40px #ff8c00;
        font-weight: bold;
        }


        .leaderboard tr:nth-child(2) td {
        color: #c0c0c0; /* Silver color */
        text-shadow: 
            0 0 5px #c0c0c0,  /* Inner glow */
            0 0 10px #c0c0c0, /* Slightly outer glow */
            0 0 20px #ffffff, /* Further outer glow with a lighter shade */
            0 0 40px #ffffff;
        font-weight: bold;
        }


        .leaderboard tr:nth-child(3) td {
        color: #cd7f32; /* Bronze color */
        text-shadow: 
            0 0 5px #cd7f32,  /* Inner glow */
            0 0 10px #cd7f32, /* Slightly outer glow */
            0 0 20px #b87333, /* Further outer glow with a darker bronze shade */
            0 0 40px #b87333;
        font-weight: bold;
        }

        .leaderboard .rank {
        width: 25%;
        text-align: center;
        }
        .leaderboard .initials {
        width: 40%;
        text-align: center;
        }

        .leaderboard td.initials {
        text-transform: uppercase;
        }

        .leaderboard .bones {
        width: 35%;
        text-align: center;
        }

        .game-info {
            display: flex;
            height: 40px;
            background-color: #882d3d;
            justify-content: space-between;
            align-items: center;
            padding: 0px;
            font-weight: bold;
            font-size: 1.5rem;
            color: white;
        }


        .level, .score {
            margin: 0 20px;
        }

        .lives {
            margin: 0 auto;
            color: #1b263b;
            display: flex;
            justify-content: left;
            font-weight: bold;
            font-size: 1.3rem;
            width: 100%;
            position: absolute;
            top: 15px;
            left: 15px;
        }        

        .life-icon-wrapper {
            width: 30px;
            height: 30px;
            background-color: white;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            margin-right: 5px;
            margin-left: 5px;
            border: 2px solid #1b263b;
        }

        .life-icon {
            width: 30px;
            height: auto;
        }

        .next-level-overlay,
        .failure-message-overlay {
            margin: 100px auto;
            display: flex;
            justify-content: center;
            font-weight: bold;
            font-size: 1.3rem;
            width: 100%;
        }


        .next-level-message,
        .failure-message {
            background-color: #ca3049;
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            width: 200px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            z-index: 1000;
        }

        .failure-message-overlay.new-chance .failure-message {
            background-color: #f0b300;
        }        
        
        .next-level-message {
            background-color: #1e4f1e;
            font-size: 1rem;
            width: 250px;
        }

        .next-level-button,
        .failure-button {
            background-color: white;
            color: #ca3049; 
            border: 2px solid #ca3049;
            padding: 10px 20px;
            border-radius: 5px;
            font-size: 1rem;
            font-weight: bold;
            cursor: pointer;
            transition: background-color 0.3s ease, color 0.3s ease, box-shadow 0.3s ease;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); 
        }

        .failure-message-overlay.new-chance .failure-button {
            background-color: white;
            color: #c77328;
            border: 2px solid #f0b300;
        }        

        .next-level-button {
            color: #1e4f1e;
            border: 2px solid #1e4f1e;
        }

        .next-level-button:hover,
        .failure-button:hover {
            background-color: rgb(227, 216, 218);
        }

        .next-level-button:focus,
        .failure-button:focus {
            outline: none;
            box-shadow: 0 0 0 3px rgba(227, 216, 218, 0.5); /* Custom focus shadow */
        }

        .bonus-animation {
            animation: moveAndShrink 2s forwards;
        }

        @keyframes moveAndShrink {
            0% {
                transform: translate(0, 0) scale(1);
            }
            50% {
                transform: translate(50%, -50%) scale(0.5);
            }
            100% {
                transform: translate(40%, -100%) scale(0);
            }
        }     

        .pulsate-score {
            animation: pulsate 0.5s ease-in-out;
            color: #ffd700; /* Golden color */
            text-shadow: 
                0 0 5px #ffd700,  /* Inner glow */
                0 0 10px #ffd700, /* Slightly outer glow */
                0 0 20px #ffd700, /* Further outer glow */
                0 0 40px #ff8c00;
        }

        .pulsate-fail {
            animation: pulsate 0.5s ease-in-out;
            color: #ff4d00; /* Golden color */
            text-shadow: 
                0 0 5px #ff4d00,  /* Inner glow */
                0 0 10px #ff4d00, /* Slightly outer glow */
                0 0 20px #ff4d00, /* Further outer glow */
                0 0 40px #ff8c00;
        }

        @keyframes pulsate {
            0% {
                transform: scale(1);
            }
            50% {
                transform: scale(1.1);
            }
            100% {
                transform: scale(1);
            }
        }    
        
          .paused-overlay {
            position: absolute;
            flex-direction: column;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            color: #ca3049;
            font-size: 2rem;
            text-align: center;
            font-weight: bold;
            z-index: 2000;
            text-shadow: 4px 4px 10px #1b263b, 4px 4px 10px #1b263b, 4px 4px 20px #1b263b, 4px 4px 30px #1b263b, 4px 4px 30px #1b263b;
        }   

  .start-overlay {
      position: absolute;
      top: 0px;
      left: 0px;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      color: white;
      font-size: 1.2rem;
      z-index: 10;
      user-se1lect: none;  /* Prevent text selection */
      -webkit-user-select: none;
      -ms-user-select: none;
      -moz-user-select: none;
      -webkit-tap-highlight-color: transparent; /* Remove tap highlight on touch devices */
}


  .start-overlay p {
    margin-bottom: 40px;
    font-size: 1.7rem;
  }

  
  .paused-overlay button {
    margin-top: 40px;
  }

  
  div.start-overlay button {
    background-color: #ca3049;
    color: #e0e1dd;
    padding: 12px 24px;
    font-size: 1.2rem;
    font-weight: bold;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 6px 10px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;
    text-transform: uppercase;
    margin-left: 15px;
    margin-right: 15px;
    letter-spacing: 1px;
    user-select: none;  /* Prevent text selection */
    -webkit-user-select: none;
    -ms-user-select: none;
    -moz-user-select: none;
  }

        .start-overlay-hidden,
        .paused-overlay-hidden {
            display: none;
        }     
        
        .instructions {
            width: 300px;
            font-size: 1rem;
            margin-top: 30px;
            text-align: left;
            margin: 20px auto;
        }

        .instructions h2 {
            cursor: pointer;
            display: flex;
            align-items: center;
            margin-bottom: 0;
            user-select: none;  /* Prevent text selection */
            -webkit-user-select: none;
            -ms-user-select: none;
            -moz-user-select: none;            
        }

        .chevron {
            margin-left: 10px;
        }

        .instructions span {
            display: block;
            font-size: 1rem;
            margin-top: 10px;
            margin-bottom: 10px;
        }
        .bonus-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            color: #ffd700; /* Golden color */
            font-size: 2rem;
            text-align: center;
            font-weight: bold;
            z-index: 2000;
            text-shadow: 
                0 0 5px #ffd700,  /* Inner glow */
                0 0 10px #ffd700, /* Slightly outer glow */
                0 0 20px #ffd700, /* Further outer glow */
                0 0 40px #ff8c00;
        }
        .hidden,
        .bonus-overlay-hidden {
            display: none;
        }        

        @media (max-width: 1400px) {
            .container {
                flex-direction: column;
            }

            .game-wrapper {
            }

            .left-column,
            .right-column {
                width: 100%;
                padding: 0;
            }
            
            .game-container,
            .game-info {
                min-width: 300px;
            }

            .button-container {
                margin-bottom: 0;
            }

            .game-info .level,
            .game-info .score {
                margin: 0 5px;
            }
            .game-info .score {
                width: 150px;
            }

            .button-container button {
                margin: 10px;
            }

        }        
    </style>
{#if !isLoadingTexts}    
<div class="container" tabindex="-1">
<div class="left-column" tabindex="-1">

    <div bind:this={gameWrapper} class="game-wrapper { gamePaused ? 'blur' : ''}{showCongratulations ? 'hidden' : ''}" tabindex="-1">
            <div class="game-info">
                <div class="level">{getLocalizedText(pageTexts, "stats_level")}: {$currentLevel}</div>
                <div class="score { pulsateScore ? 'pulsate-score' : ''} {pulsateFail ? 'pulsate-fail' : ''}">{getLocalizedText(pageTexts, "stats_bones")}: {$bonesCollected + $bonesCollectedLevel}</div>
            </div>
        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
        <div
            bind:this={gameContainer}
            class="game-container"
            role="application"
            on:keydown={handleKeyDown}
            on:keyup={handleKeyUp}
            tabindex="-1">
            <div class="lives {showBonusAnimation ? 'bonus-animation' : ''}">
                {#each Array($lives) as _, i}
                    <div class="life-icon-wrapper">
                        <img src="/images/dogrun/dog/sitting.png" alt="{getLocalizedText(pageTexts, "life")}" class="life-icon" />
                    </div>
                {/each}
            </div>
            {#if showFailureMessage}
            <div class="failure-message-overlay new-chance">
                <div class="failure-message">
                    <p>{getLocalizedText(pageTexts, "level_failed")}</p>
                    <button class="failure-button" on:click={acknowledgeFailure}>{getLocalizedText(pageTexts, "try_again")}</button>
                </div>
            </div>
            {/if}
            {#if showGameOverMessage}
            <div class="failure-message-overlay">
                <div class="failure-message">
                    <p>{getLocalizedText(pageTexts, "game_over")}</p>
                    <button class="failure-button" on:click={startOver}>{getLocalizedText(pageTexts, "start_over")}</button>
                </div>
            </div>
            {/if}
            {#if showNextLevelMessage}
            <div class="next-level-overlay">
                <div class="next-level-message">
                    <p>{currentMessage}</p>
                    <button class="next-level-button" on:click={nextLevel}>{getLocalizedText(pageTexts, "continue")}</button>
                </div>
            </div>
            {/if} 
                <Ground x={0-cameraOffsetX} y={groundHeight} height={40} width={5000} groundAdjustment={9} />
                <Dog x={dog.x} y={dog.y} state={dogState}  />
                {#each platforms as platform}
                    <Platform x={platform.x - cameraOffsetX} y={platform.y} width={platform.width} height={platform.height} platformAdjustment={platform.platformAdjustment}  />
                {/each}
                {#each holes as hole}
                    <Hole x={hole.x - cameraOffsetX} width={hole.width} y={hole.y} height={groundHeight} />
                {/each}
                {#each spikes as spike}
                    <Spike x={spike.x - cameraOffsetX} y={spike.y} width={spike.width} height={spike.height} />
                {/each}
                {#each bones as bone}
                    <Bone x={bone.x - cameraOffsetX} y={bone.y} width={bone.width} height={bone.height} />
                {/each}
                <Goal x={goal.x - cameraOffsetX} y={goal.y} />
                </div>
                <VirtualJoystick on:key={handleVirtualKey} />
    </div>
    <div bind:this={pausedOverlay} class="paused-overlay {!gamePaused ? 'paused-overlay-hidden' : ''}" >
        {getLocalizedText(pageTexts, "press_to_continue")}
        <button class="pause-button" on:click={togglePause}>{gamePaused ? getLocalizedText(pageTexts, "resume") : getLocalizedText(pageTexts, "pause")}</button>
    </div>

    <div bind:this={startOverlay} class="start-overlay {hasStarted ? 'start-overlay-hidden' : ''}" >
        <p>{getLocalizedText(pageTexts, "start_game")}</p>
        <button class="start-button" on:click={startGame}>{getLocalizedText(pageTexts, "start")}</button>
    </div>
    
    <div bind:this={bonusOverlay} class="bonus-overlay {showBonusAnimation ? '' : 'bonus-overlay-hidden'}">
        {
          getLocalizedText(pageTexts, "bonus_for_lives")
            .replace("<LIVES>", $lives)
            .replace("<LIFE_TEXT>", getLocalizedText(pageTexts, $lives === 1 ? "life_singular" : "life_plural"))            
        }
    </div>    

    {#if showCongratulations}
    <Message type="winner" congrats_title={getLocalizedText(pageTexts, "congrats_title")} message={currentMessage} />
    {/if}
    {#if showVirtualKeyboard}
        <VirtualKeyboard onSubmit={handleSubmitInitials} />
        <button class="reset-button" on:click={startGame}>{getLocalizedText(pageTexts, "start_over")}</button>
    {/if}


{#if showErrorMessage}
<Message type="error" message={currentMessage} />
{/if}

{#if hasStarted && !showCongratulations}    
<div class="button-container">
    {#if !showFailureMessage && !showGameOverMessage}
    <button class="pause-button" on:click={togglePause}>{gamePaused ? getLocalizedText(pageTexts, "resume") : getLocalizedText(pageTexts, "pause")}</button>
    {/if}
    <button class="reset-button" on:click={startOver}>{getLocalizedText(pageTexts, "start_over")}</button>
</div>
{/if}

</div>
<div class="right-column" tabindex="-1">
    {#if leaderboard && leaderboard.length > 0}
    <div class="leaderboard" tabindex="-1">
        <h2>{getLocalizedText(pageTexts, "high_score")}</h2>
        <table>
          <thead>
            <tr>
              <th class="rank">{getLocalizedText(pageTexts, "rank")}</th>
              <th class="initials">{getLocalizedText(pageTexts, "initials")}</th>
              <th class="bones">{getLocalizedText(pageTexts, "leaderboard_score")}</th>
            </tr>
          </thead>
          <tbody>
            {#each leaderboard as { initials, bones }, i}
              <tr>
                <td class="rank">{i + 1}.</td>
                <td class="initials">{initials}</td>
                <td class="bones">{bones} {getLocalizedText(pageTexts, bones === 1 ? "bone_singular" : "bone_plural")}</td>
              </tr>
            {/each}
          </tbody>
        </table>
    </div>
    {/if}
    <div class="instructions">
        <h2 title="{getLocalizedText(pageTexts, "instructions_show")}" on:click={toggleInstructions} aria-expanded={instructionsVisible} aria-controls="instructions-content">
            {getLocalizedText(pageTexts, "instructions_title")}
            <span class="chevron">{instructionsVisible ? '▼' : '▲'}</span>
        </h2>
        {#if instructionsVisible}
            <div id="instructions-content">
                {@html getLocalizedText(pageTexts, "instructions")}
                <p class="keyboard-shortcuts">
                    <span>{@html getLocalizedText(pageTexts, "instructions_walk")}</span>
                    <span>{@html getLocalizedText(pageTexts, "instructions_jump")}</span>
                    <span>{@html getLocalizedText(pageTexts, "instructions_pause")}</span>
                    <span>{@html getLocalizedText(pageTexts, "instructions_start_over")}</span>
                    <span>{@html getLocalizedText(pageTexts, "instructions_next_level")}</span>
                    <span>{@html getLocalizedText(pageTexts, "instructions_try_level_again")}</span>
                </p>
            </div>
        {/if}
    </div>
</div>     
</div>
{/if}