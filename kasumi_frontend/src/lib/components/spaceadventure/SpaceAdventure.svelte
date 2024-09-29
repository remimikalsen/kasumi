<script>
  import { onMount, onDestroy } from 'svelte';
  import { Spacecraft } from './spacecraft.js';
  import { Asteroid } from './asteroid.js';
  import { Bullet } from './bullet.js';
  import { BonusPack, BonusType } from './bonus.js';
  import Icon from '@iconify/svelte';
  import { getLocalizedText, loadTexts, activeLanguage } from '$lib/stores/translatedTexts.js';
  import VirtualKeyboard from '$lib/components/common/VirtualKeyboard.svelte';
  import VirtualJoystick from '$lib/components/common/VirtualJoystickFourWay.svelte';

  const pageTexts = 'spaceadventure';
  let isLoadingTexts = true;
  let instructionsVisible = false;

  let canvas;
  let ctx;
  let isPaused = false;
  let totalPauseTime = 0;
  let pauseStartTime = 0;
  let lastPauseTime = 0;
  let animationFrameId;
  let stars = [];
  let hasStarted = false;

  let audioContext;
  let soundBuffers = [];

  let width = 0;
  let height = 0;
  const shotsPerSecond = 4; // maximum firing rate
  const shotsPerTimeWindow = 10; // total ammo available per time window
  const shotsTimeWindow = 5; // seconds
  const bonusInterval = 30 // seconds
  const bonusRandom = 0.001; // probability of bonus spawn per frame
  const bonusDuration = 20; // seconds
  const initialAsteroidSpawnInterval = 2; // Start with light density, asteroids per second

  let pausedOverlay;
  let gameOverOverlay;
  let startOverlay;
  let gameWrapper;

  let ship;
  let asteroids = [];
  let bullets = [];
  let bonuses = [];
  let activeBonus = null;
  let bonusEndTime = 0;
  let score = 0;
  let startTime = Date.now();
  let lastBonusSpawn = Date.now();

  let shotTimestamps = [];
  let ammoPercentage = 100;

  let asteroidSpawnInterval = initialAsteroidSpawnInterval*1000; // Start with light density
  let lastSpawn = Date.now();
  let gameOver = false;

  let keysPressed = {};
  let lastFireTime = 0;
  let waveActive = false; // Flag for wave effect
  let waveStartTime = 0;
  let waveX = 0;
  let waveY = 0;

  let backgroundTrack = '/spaceadventure/sounds/game-tune-5.mp3';
  let backgroundAudio = null;  

  let isMusicMuted = false;
  let areSoundEffectsMuted = false;
  let leaderboard;
  let showVirtualKeyboard = false;
  let playerInitials = '';
  let statusDiv;
  let virtualJoystickDiv;
  let lastTap = 0;

  const preventScroll = (e) => {
    e.preventDefault();
  };

  onMount(async () => {
    await fetchTexts();

    const preventScroll = (e) => {
      if (hasStarted && !gameOver) {
        e.preventDefault();
      }
    };

    if (typeof window !== 'undefined') {
      updateDimensions();
      ctx = canvas.getContext('2d');
      loadLeaderboard();
      ship = new Spacecraft(width, height);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('resize', updateOverlayPositions);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      canvas.addEventListener('touchend', handleDoubleTap);
      updateOverlayPositions();
      initializeStars();
      canvas.focus();
    }

  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', updateDimensions);
      canvas.removeEventListener('touchend', handleDoubleTap);  
      window.removeEventListener('touchmove', preventScroll);
    }

    if (backgroundAudio) {
      backgroundAudio.pause();
    }

    window.removeEventListener('touchmove', preventScroll, { passive: false });
    document.body.classList.remove('no-scroll');
  });


  function updateDimensions() {
    const statusHeight = statusDiv ? statusDiv.getBoundingClientRect().height : 0;
    const joystickHeight = virtualJoystickDiv ? virtualJoystickDiv.getBoundingClientRect().height : 0;
    const totalHeight = statusHeight + joystickHeight;

    width = Math.min(800, window.innerWidth);
    height = Math.min(600, window.innerHeight - totalHeight);

    if (canvas) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  async function fetchTexts() {
      isLoadingTexts = true;
      await loadTexts(pageTexts);
      //await loadTexts(commonTexts);
      isLoadingTexts = false;
  }

  $: $activeLanguage, fetchTexts();

  async function fetchLeaderboard() {
      const response = await fetch('/api/space-adventure/get_leaderboard');
      return await response.json();
  }


  async function loadLeaderboard() {
      const data = await fetchLeaderboard();

      if (Array.isArray(data) && data.length > 0) {
          leaderboard = [...data];
      }
  }


  function initializeStars() {
      for (let i = 0; i < 50; i++) {
          stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 2 + 1,
          speed: Math.random() * 0.5 + 0.5
          });
      }
  }

  async function loadSounds(sounds) {
      const promises = sounds.map(async ({ name, url }) => {
          const response = await fetch(url);
          if (!response.ok) {
              throw new Error(`Failed to load sound "${name}"`);
          }
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          soundBuffers[name] = audioBuffer;
      });
      await Promise.all(promises); // Wait for all sounds to be loaded
  }

  function playSound(name) {
      if (areSoundEffectsMuted) return;

      const buffer = soundBuffers[name];
      if (buffer) {
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start(0);
      } else {
      console.error(`Sound "${name}" not found.`);
      }
  }    

  function handleKeyDown(e) {
      if (e.code === 'KeyP') {
          togglePause();
      } else if (e.code === 'KeyR') {
          resetGame();
      } else if (e.code === 'KeyM') {
          toggleMusicMute();
      } else if (e.code === 'KeyS') {
          toggleSoundEffectsMute();
      } else {
          keysPressed[e.code] = true;
      }
      e.preventDefault();
  }

  function handleKeyUp(e) {
    keysPressed[e.code] = false;
  }
  
  function handleVirtualKey(event) {
    const { key } = event.detail;
    console.log("handleVirtualKey" + key);
    keysPressed[key] = true;
    setTimeout(() => {
      keysPressed[key] = false;
    }, 100);
  }

  async function togglePause() {
    if (!hasStarted) {
        return;
    }
    isPaused = !isPaused;

    if (isPaused) {
        playSound('pause');
        pauseBackgroundAudio();
        pauseStartTime = Date.now();
        document.body.classList.remove('no-scroll');
        window.removeEventListener('touchmove', preventScroll, { passive: false });
    } else {
        playSound('start');
        playBackgroundAudio();
        totalPauseTime += Date.now() - pauseStartTime;
        lastPauseTime = Date.now() - pauseStartTime;
        gameLoop();
        scrollAndFreeze();
    }
    canvas.focus();
  }

  function fireBullets() {
      const now = Date.now();

      // Limit firing rate per time window 
      if (now - lastFireTime < (1000/shotsPerSecond)) {
          return;
      } 

      // Limit firing rate per time window
      if (now - lastFireTime >= (1000/shotsPerSecond) && shotTimestamps.length >= shotsPerTimeWindow) {
          lastFireTime = now;
          playSound('overheat');
          return;
      } 

      shotTimestamps.push(now);
      lastFireTime = now;

      if (activeBonus === BonusType.Trident) {
          bullets.push(new Bullet(ship.x + ship.width / 2 - 2.5, ship.y));
          playSound('laser');
          bullets.push(new Bullet(ship.x + ship.width / 2 - 2.5, ship.y, -15));
          playSound('laser');
          bullets.push(new Bullet(ship.x + ship.width / 2 - 2.5, ship.y, 15));
          playSound('laser');
      } else if (activeBonus === BonusType.DoubleTrouble) {
          bullets.push(new Bullet(ship.x + ship.width / 2 - 10, ship.y));
          playSound('laser');
          bullets.push(new Bullet(ship.x + ship.width / 2 + 5, ship.y));
          playSound('laser');
      } else {
          bullets.push(new Bullet(ship.x + ship.width / 2 - 2.5, ship.y));
          playSound('laser');
      }
  }

  function updateOverlayPositions() {
          updateDimensions();

          let addedBorders = 0;

          if (gameWrapper && pausedOverlay) {
              const rect = gameWrapper.getBoundingClientRect();
              pausedOverlay.style.top = `${rect.top + window.scrollY - addedBorders}px`;
              pausedOverlay.style.left = `${rect.left + window.scrollX - addedBorders}px`;
              pausedOverlay.style.width = `${rect.width + addedBorders*2}px`;
              pausedOverlay.style.height = `${rect.height + addedBorders*2}px`;
          }

          if (gameWrapper && gameOverOverlay) {
              const rect = gameWrapper.getBoundingClientRect();
              gameOverOverlay.style.top = `${rect.top + window.scrollY - addedBorders}px`;
              gameOverOverlay.style.left = `${rect.left + window.scrollX - addedBorders}px`;
              gameOverOverlay.style.width = `${rect.width + addedBorders*2}px`;
              gameOverOverlay.style.height = `${rect.height + addedBorders*2}px`;
          }

          if (gameWrapper && startOverlay) {
              const rect = gameWrapper.getBoundingClientRect();
              startOverlay.style.top = `${rect.top + window.scrollY - addedBorders}px`;
              startOverlay.style.left = `${rect.left + window.scrollX - addedBorders}px`;
              startOverlay.style.width = `${rect.width + addedBorders*2}px`;
              startOverlay.style.height = `${rect.height + addedBorders*2}px`;
          }

  }  

  function gameLoop() {
    if (!ctx || !ship || isPaused) return; // Ensure ctx and ship are defined and game is not paused

    const now = Date.now();

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (gameOver) {
        return;
    }

    // Draw stars
    stars.forEach((star) => {
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        // Update star position
        star.y += star.speed;
        if (star.y > height) {
        star.y = 0;
        star.x = Math.random() * width;
        }
    });      

    // Increase difficulty over time
    const elapsedSeconds = (now - startTime - totalPauseTime) / 1000;
    asteroidSpawnInterval = Math.max(initialAsteroidSpawnInterval*1000 - elapsedSeconds * 40, 500);
    const speedFactor = 1 + Math.floor(elapsedSeconds / 5) * 0.2;

      if (lastPauseTime > 0) {
          shotTimestamps = shotTimestamps.map(timestamp => timestamp + lastPauseTime);
      }
      shotTimestamps = shotTimestamps.filter(timestamp => now - timestamp <= 1000*shotsTimeWindow ); // remove timestamps older than shotsTimeWindow seconds
      ammoPercentage = (shotsPerTimeWindow - shotTimestamps.length) / 10 * 100;

   // Render wave effect if active
    if (lastPauseTime > 0) {
      waveStartTime += lastPauseTime;
    }

    if (waveActive) {
      const waveDuration = 800; 
      const waveElapsed = now - waveStartTime;
      const maxRadius = Math.sqrt(width * width + height * height) / 2;
      const waveRadius = (waveElapsed / waveDuration) * maxRadius;

      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.arc(waveX, waveY, waveRadius, 0, Math.PI * 2);
      ctx.fill();

      // Check for collisions with asteroids
      asteroids.forEach((asteroid) => {
        const dist = Math.sqrt((asteroid.x - waveX) ** 2 + (asteroid.y - waveY) ** 2);
        if (dist < waveRadius + asteroid.size * 10) {
          asteroid.takeHit(ctx);
          playSound('hit');
        }
      });

      // Remove destroyed asteroids
      asteroids = asteroids.filter((asteroid) => {
          if (asteroid.hp <= 0) {
              score += asteroid.size;
              playSound('rock-explode');
              return false;
          }
          return true;
      });

      // End wave effect after duration
      if (waveElapsed > waveDuration) {
        waveActive = false;
      }
    }

    // Spawn bonuses occasionally
    if (lastPauseTime > 0) {
      lastBonusSpawn += lastPauseTime;
    }

    if (now - lastBonusSpawn > bonusInterval * 1000 || Math.random() < bonusRandom) { 
      spawnBonus();
      lastBonusSpawn = now;
    }

    // Update and draw bonuses
    bonuses.forEach((bonus) => {
      bonus.update();
      bonus.draw(ctx);
    });

    // Collision with spacecraft (for bonuses)
    bonuses = bonuses.filter((bonus) => {
      if (
        bonus.x < ship.x + ship.width &&
        bonus.x + 44 > ship.x &&
        bonus.y < ship.y + ship.height &&
        bonus.y + 44 > ship.y
      ) {
        activateBonus(bonus.type, bonus.x, bonus.y);
        return false; // Remove bonus
      }
      return bonus.y < height + 44;
    });

    // Handle active bonus expiration
    if (lastPauseTime > 0) {
      bonusEndTime += lastPauseTime;
    }
    if (activeBonus != null && now > bonusEndTime) {
      activeBonus = null;
      playSound('bonus-end');
    }

    // Spawn asteroids
    if (lastPauseTime > 0) {
      lastSpawn += lastPauseTime;
    }
    if (now - lastSpawn > asteroidSpawnInterval) {
      asteroids.push(new Asteroid(width));
      lastSpawn = now;
    }

    // Update and draw asteroids
    asteroids.forEach((asteroid) => {
      asteroid.update(speedFactor);
      asteroid.draw(ctx);
    });

    // Remove off-screen asteroids
    asteroids = asteroids.filter((a) => a.y < height + a.size * 10 && a.hp > 0);

    // Update and draw bullets
    bullets.forEach((bullet) => {
      bullet.update();
      bullet.draw(ctx);
    });

    // Remove off-screen bullets
    bullets = bullets.filter((b) => b.y > -b.height);

    // Collision detection between bullets and asteroids
    bullets.forEach((bullet) => {
      asteroids.forEach((asteroid) => {
        if (
          bullet.x < asteroid.x + asteroid.size * 10 &&
          bullet.x + bullet.width > asteroid.x - asteroid.size * 10 &&
          bullet.y < asteroid.y + asteroid.size * 10 &&
          bullet.y + bullet.height > asteroid.y - asteroid.size * 10
        ) {
          asteroid.takeHit(ctx);
          playSound('hit');
          bullet.y = -bullet.height; // Remove bullet

          if (asteroid.hp <= 0) {
            // Increase score based on asteroid size
            score += asteroid.size;
            asteroid.y = height + asteroid.size * 10; // Remove asteroid
            playSound('rock-explode');
          }
        }
      });
    });

    // Check for collision between ship and asteroids
    asteroids.forEach((asteroid) => {
      if (
        ship.x < asteroid.x + asteroid.size * 10 - 10 &&
        ship.x + ship.width > asteroid.x - asteroid.size * 10 + 10 &&
        ship.y < asteroid.y + asteroid.size * 10 - 10 &&
        ship.y + ship.height > asteroid.y - asteroid.size * 10 + 10
      ) {
        playSound('explode');
        gameOver = true;
        showVirtualKeyboard = true;
        document.body.classList.remove('no-scroll');
        window.removeEventListener('touchmove', preventScroll, { passive: false });
      }
    });

    // Update ship position based on keys pressed
    if (keysPressed['ArrowLeft'] && !keysPressed['ArrowRight']) {
      ship.moveLeft();
    }
    if (keysPressed['ArrowRight'] && !keysPressed['ArrowLeft']) {
      ship.moveRight(width);
    }
    if (keysPressed['ArrowUp'] && !keysPressed['ArrowDown']) {
      ship.moveUp();
    }
    if (keysPressed['ArrowDown'] && !keysPressed['ArrowUp']) {
      ship.moveDown(height);
    }
    if (keysPressed['Space']) {
      fireBullets();
    }

    // Draw the spacecraft
    ship.draw(ctx);

    lastPauseTime = 0;

    // Request next frame
    animationFrameId = requestAnimationFrame(gameLoop);
  }

  function spawnBonus() {
    bonuses.push(new BonusPack(width));
  }

  function activateBonus(type, x, y) {
    activeBonus = type;
    if (type !== BonusType.MonsterShot) {
      playSound('bonus');
      bonusEndTime = Date.now() + 1000 * bonusDuration; 
    }

    if (type === BonusType.MonsterShot) {
      // Activate wave effect
      waveActive = true;
      waveStartTime = Date.now();
      waveX = x;
      waveY = y;
      playSound('monster-wave');
    }
  }

  function createBackgroundAudio() {
    if (backgroundAudio) {
      backgroundAudio.pause();
    }
    backgroundAudio = new Audio(backgroundTrack);
    backgroundAudio.loop = true;
  }

  function playBackgroundAudio() {
    if (isMusicMuted) return;

    if (!backgroundAudio) {
      createBackgroundAudio();
    }
    backgroundAudio.play();
  }

  function pauseBackgroundAudio() {
    if (backgroundAudio) {
      backgroundAudio.pause();
    }
  }

  function togglePlayPauseBackgroundAudio() {
    if (backgroundAudio && !backgroundAudio.paused) {
      pauseBackgroundAudio();
    } else {
      playBackgroundAudio();
    }
  }


  function toggleMusicMute() {
      isMusicMuted = !isMusicMuted;
      if (isMusicMuted) {
        pauseBackgroundAudio();
      } else {
        playBackgroundAudio();
      }
    }

    function toggleSoundEffectsMute() {
      areSoundEffectsMuted = !areSoundEffectsMuted;
    }

  async function runFirstTime() {

      if (!hasStarted) {
          hasStarted = true;
      }

      if (!backgroundAudio) {
        createBackgroundAudio();
      }

      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        await loadSounds([
          { name: 'laser', url: '/spaceadventure/sounds/laser.mp3' },
          { name: 'pause', url: '/spaceadventure/sounds/pause.mp3' },
          { name: 'start', url: '/spaceadventure/sounds/start.mp3' },
          { name: 'hit', url: '/spaceadventure/sounds/hit.mp3' },
          { name: 'explode', url: '/spaceadventure/sounds/explode.mp3' },
          { name: 'overheat', url: '/spaceadventure/sounds/overheat.mp3' },
          { name: 'rock-explode', url: '/spaceadventure/sounds/rock-explode.mp3' },
          { name: 'bonus', url: '/spaceadventure/sounds/bonus.mp3' },
          { name: 'monster-wave', url: '/spaceadventure/sounds/monster-wave.mp3' },
        ]); 
        playSound('start');       
      }
  }

  function toggleInstructions() {
      instructionsVisible = !instructionsVisible;
  } 


  async function handleSubmitInitials(initials) {
      playerInitials = initials;
      await storeScore(playerInitials, score);  // Store the score in the database
      await loadLeaderboard();  // Load the updated leaderboard after the score is stored
      showVirtualKeyboard = false;
  }

  async function storeScore(initials, points) {
      await fetch('/api/space-adventure/submit_score', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json'
      },
      body: JSON.stringify({ initials, points })
      });
  }         

  async function resetGame() {
    if (!hasStarted) {
        runFirstTime();
        playBackgroundAudio();
    } else {
        playSound('start');
        playBackgroundAudio();
    }

    gameOver = false;
    score = 0;
    asteroids = [];
    bullets = [];
    bonuses = [];
    shotTimestamps = [];
    startTime = Date.now();
    lastSpawn = 0;
    lastBonusSpawn = Date.now();
    totalPauseTime = 0;
    isPaused = false;
    waveActive = false;
    activeBonus = null;
    ship = new Spacecraft(width, height);
    canvas.focus();
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    gameLoop();

    scrollAndFreeze();  

}

  async function scrollAndFreeze() {
    if (window.innerWidth <= 800) { // Adjust the width threshold as needed
        gameWrapper.scrollIntoView({ behavior: 'smooth' });
        await waitForScrollToEnd();
        gameWrapper.classList.add('fixed-game-wrapper');
        document.body.classList.add('no-scroll');
        window.addEventListener('touchmove', preventScroll, { passive: false });
    } 
  }

  function handleVisibilityChange() {
      if (document.hidden) {
          if (!isPaused) {
          togglePause();
          }
      }
  }

  function handleDoubleTap(event) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    if (tapLength < 300 && tapLength > 0) {
      togglePause();
    }
    lastTap = currentTime;
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


</script>

<style>

   .fixed-game-wrapper {
      position: sticky;
      top: 0;
      z-index: 1000; /* Ensure it stays on top */
    }

  .left-column,
  .right-column {
      flex: 0 1 auto; 
      display: flex;
      flex-direction: column; /* Stack content vertically */
      /*justify-content: center;*/ /* Center content vertically */
      align-items: center; /* Center content horizontally */
      padding: 20px;
      min-width: 320px;
  }

  canvas {
    background: black;
    display: block;
    margin: 0 auto;
  }

  .page-wrapper {
    display: flex;
    justify-content: center;
    align-items: stretch;
    width: 100%;
  }

  .game-wrapper {
      display: block;
  }

  .pause-overlay,
  .game-over-overlay,
  .start-game-overlay {
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

  .start-game-overlay p,
  .start-game-overlay p,
  .game-over-overlay p.start_over {
    margin-bottom: 40px;
  }

  div.buttons {
      display: flex;
      justify-content: center;
      margin-top: 30px;
  } 

  div.game-over-overlay button,
  div.start-game-overlay button,
  div.start-game-overlay button,
  div.pause-overlay button,
  div.buttons button {
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

  div.buttons button:disabled {
    background-color: #2f2f2e;
    color: #777777;
    cursor: not-allowed;
  }

  div.buttons .pause {
    width: 170px;
  }

  div.buttons .reset {
    width: 220px;
  }

  div.status {
    display: flex;
    background-color: #882d3d;
    justify-content: space-between;
    align-items: center;
    padding: 0px;
    font-weight: bold;
    font-size: 1.5rem;
    color: white;
    margin-top: 0px;
  }

  div.status .status-left,
  div.status .status-right {
      padding: 10px;
      text-align: left;
  }


  div.status .status-left .score .points {
      display: inline-block;
      width: 64px;
      color: gold;
      font-weight: bold;
      text-align: right;
      font-family: monospace;
  }

  div.status .status-left .score .title {
      display: inline-block;
      margin-left: 3px;
      text-transform: lowercase;
  }

  div.status .sound {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
  }

  div.status .sound .music,
  div.status .sound .sfx {
    display: flex;
    align-items: right;
    margin-top: 5px;
  }

  div.status .sound .music .icon-circle,
  div.status .sound .sfx .icon-circle {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  div.status .sound .title {
    display: inline-block;
    width: 130px;
    margin-left: 5px;
    text-align: left;
    vertical-align: middle;
    margin-top: 4px;
  }

  div.status .sound button {
    display: inline-block;
    background: none;
    border: none;
    cursor: pointer;
    color: white;
    font-size: 1.2rem;
  }

  div.icon-circle {
    display: inline-block;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-color: transparent;
    border: 2px solid white;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: box-shadow 0.3s ease;
  }

  div.icon-circle:hover {
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
  }

  div.icon-circle:active {
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.7);
  }

  div.weaponry {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-top: -10px;
    margin-bottom: 5px;

  }

  div.weaponry .weaponry-status,
  div.weaponry .weaponry-type {
      display: flex;
      flex-direction: row;
      align-items: center;
  }

  div.weaponry .ammo-bar,
  div.weaponry .overheating {
      display: inline-block;
      width: 100px;
      height: 25px;
      margin-top: 1px;
      box-sizing: border-box;
      background-color: white;
      border: 1px solid black;
  }

  div.weaponry .ammo-bar div.ammo-fill {
      height: 100%;
      background-color: green;
  }

  div.weaponry .overheating div.ammo-fill {
    height: 100%;
    background-color: red;
    animation: glow 1s infinite alternate;
  }

  div.weaponry span.weapon-name {
      display: inline-block;
      margin-right: 5px;
    }

  div.weaponry .weapon-status {
      display: inline-block;
      margin-left: 25px;
      margin-right: 10px;
  }



  @keyframes glow {
    from {
      box-shadow: 0 0 5px red;
    }
    to {
      box-shadow: 0 0 20px red;
    }
  }

  .hide {
      display: none;
  }

  .instructions {
            min-width: 290px;
            max-width: 340px;
            font-size: 1.1rem;
            margin-top: 30px;
            text-align: left;
            margin: 20px auto;
            font-family: sans-serif;
        }

        .instructions h2 {
            cursor: pointer;
            display: flex;
            align-items: center;
            margin-bottom: 0;
            font-family: monospace;
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
            font-size: 1.1rem;
            margin-top: 10px;
            margin-bottom: 10px;
            font-family: sans-serif;
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
        min-width: 290px;
        max-width: 340px;
        margin: 20px auto;
        font-size: 1.3rem;
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
            0 0 10px #ffd700, /* Slightly outer glow */
            0 0 20px #ffd700;
        font-weight: bold;
        }


        .leaderboard tr:nth-child(2) td {
        color: #c0c0c0; /* Silver color */
        text-shadow: 
            0 0 10px #c0c0c0, /* Slightly outer glow */
            0 0 20px #ffffff;
        font-weight: bold;
        }


        .leaderboard tr:nth-child(3) td {
        color: #cd7f32; /* Bronze color */
        text-shadow: 
            0 0 10px #cd7f32, /* Slightly outer glow */
            0 0 20px #b87333;
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

        .leaderboard .points {
        width: 35%;
        text-align: center;
        font-family: monospace;
        }

    p.pause_title {
      margin-bottom: 40px;
    }

    p.game_over_title {
      font-size: 3rem;
      font-weight: bold;
      margin-bottom: 0;
    }

    p.game_over_score {
     margin-top: 0;
     font-size: 2rem;
    }

    p.game_over_score span {
      font-weight: bold;
      color: gold;
      font-family: monospace; 
    }

    p.game_over_high_score_pretext {
      margin-top: 30px;
      margin-bottom: 30px;
      font-size: 1.8rem;
      font-weight: bold;
    }

    .game-over-overlay .leaderboard {
      margin-top: 50px;
    }

    @media (max-width: 1300px) {
        .page-wrapper {
            flex-direction: column;
            margin-top: 20px;
            margin-bottom: 20px;
        }

    } 

    @media (max-width: 700px) {
 
      div.status .title {
            display: none;            
        }

        div.left-column,
        div.right-column {
          padding: 0;
        }
        div.keyboard-holder {
          display: flex;
          justify-content: center;
        }

        
        div.status div.sound {
          flex-direction: row;
          
        }

        div.status div.sound .music,
        div.status div.sound .sfx {
          margin: 0;
        }
        
        div.status div.weaponry {
          margin: 0;
        }

        div.status div.status-left,
        div.status div.status-right {
          display: flex;
          flex-direction: row;
          padding: 0;
        }

        div.status div.status-left .score {
          margin-left: 10px;
          margin-top: 10px;
        }

        div.status div.weaponry-status div.ammo-bar {
          width: 50px;
        }        

    div.status div.weaponry span.weapon-name,
    div.status .weapon-status,
    div.status div.status-left div.score span.title,
    div.status .music .title,
    div.status .sfx .title{
       display: none;
    }

        
        div.buttons {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-top: 50px;
        }

        div.buttons button.pause,
        div.buttons button.reset{
          width: 250px;
          margin: 10px;
        }

    }
</style>

{#if !isLoadingTexts}
<div class="page-wrapper">

<div class="left-column">
  <div bind:this={gameWrapper} class="game-wrapper">
  <div bind:this={statusDiv} class="status">
    <div class="status-left">

        <div class="weaponry">
          <div class="weaponry-type">
            <span class="weapon-name">{getLocalizedText(pageTexts, "weapon")}:</span>
            <img class="weapon-icon"
              src={activeBonus === BonusType.Trident ? '/spaceadventure/trident.png' : activeBonus === BonusType.DoubleTrouble ? '/spaceadventure/double-trouble.png' : '/spaceadventure/single.png'} 
              alt={activeBonus === BonusType.Trident ? getLocalizedText(pageTexts, "trident") : activeBonus === BonusType.DoubleTrouble ? getLocalizedText(pageTexts, "double-trouble") : getLocalizedText(pageTexts, "standard")} 
              width="50" 
              height="50" 
              /> 
          </div>
          <div class="weaponry-status">
            <span class="weapon-status">{getLocalizedText(pageTexts, "readiness")}:</span>
            <div class="{ammoPercentage === 0 ? 'hide' : 'ammo-bar'}">
              <div class="ammo-fill" style="width: {ammoPercentage}%"></div>
            </div>
            <div class="{ammoPercentage === 0 ? 'overheating' : 'hide'}">
              <div class="ammo-fill" style="width: 100%"></div>
            </div>        
          </div>   
        </div>

        <div class="score">
          <span class="points">{String(score).padStart(5, '0')}</span>
          <span class="title">{getLocalizedText(pageTexts, "points")}</span>
        </div>

    </div>
    <div class="status-right">
      <div class="sound">
        <div class="music">
          <button class="mute" on:click={toggleMusicMute}>
            <div class="icon-circle">
            <Icon icon={isMusicMuted ? 'mdi:music-off' : 'mdi:music'} />
            </div>
          </button>
          <span class="title">{getLocalizedText(pageTexts, "music")} {isMusicMuted ? getLocalizedText(pageTexts, "off") : getLocalizedText(pageTexts, "on")}</span>
        </div>
        <div class="sfx">
          <button class="mute" on:click={toggleSoundEffectsMute}>
            <div class="icon-circle">
              <Icon icon={areSoundEffectsMuted ? 'mdi:flash-off' : 'mdi:flash'} />
            </div>
          </button>
          <span class="title">{getLocalizedText(pageTexts, "sfx")} {areSoundEffectsMuted ? getLocalizedText(pageTexts, "off") : getLocalizedText(pageTexts, "on")}</span>
        </div>
      </div>
  </div>
  </div>
  <canvas bind:this={canvas} width={width} height={height}></canvas>
  <div class="keyboard-holder" bind:this={virtualJoystickDiv}>
    <VirtualJoystick on:key={handleVirtualKey} spaceKey="{getLocalizedText(pageTexts, "fire")}" />
  </div>
  </div>
  <div class="buttons">
    <button class="pause" on:click={togglePause} disabled={gameOver || !hasStarted}>{isPaused ? getLocalizedText(pageTexts, "resume") : getLocalizedText(pageTexts, "pause")}</button>
    {#if !hasStarted}
      <button class="reset" on:click={resetGame}>{getLocalizedText(pageTexts, "start-game")}</button>
    {:else}
      <button class="reset" on:click={resetGame}>{getLocalizedText(pageTexts, "restart-game")}</button>
    {/if}
  </div>  
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
            <th class="points">{getLocalizedText(pageTexts, "leaderboard_score")}</th>
          </tr>
        </thead>
        <tbody>
          {#each leaderboard as { initials, points }, i}
            <tr>
              <td class="rank">{i + 1}.</td>
              <td class="initials">{initials}</td>
              <td class="points">{String(points).padStart(5, '0')}</td>
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
                  <span>{@html getLocalizedText(pageTexts, "instructions_steer")}</span>
                  <span>{@html getLocalizedText(pageTexts, "instructions_shoot")}</span>
                  <span>{@html getLocalizedText(pageTexts, "instructions_pause")}</span>
                  <span>{@html getLocalizedText(pageTexts, "instructions_start_over")}</span>
                  <span>{@html getLocalizedText(pageTexts, "instructions_music")}</span>
                  <span>{@html getLocalizedText(pageTexts, "instructions_sfx")}</span>
              </p>
          </div>
      {/if}
  </div>
</div>     

</div>

<div bind:this={pausedOverlay} class="pause-overlay { !isPaused ? 'hide' : ''}">
  <p class="pause_title">{@html getLocalizedText(pageTexts, "p_to_resume")}</p>
  <button class="pause" on:click={togglePause} disabled={gameOver || !hasStarted}>{isPaused ? getLocalizedText(pageTexts, "resume") : getLocalizedText(pageTexts, "pause")}</button>
</div>

<div bind:this={gameOverOverlay} class="game-over-overlay { !gameOver ? 'hide' : ''}">
  <p class="game_over_title">{getLocalizedText(pageTexts, "game_over")}</p>
  {#if showVirtualKeyboard}
  <p class="game_over_score">{getLocalizedText(pageTexts, "your_score")}: <span>{String(score).padStart(5, '0')}</span></p>
  <p class="game_over_high_score_pretext">{getLocalizedText(pageTexts, "pretext_submit_highscore")}</p>
  <VirtualKeyboard onSubmit={handleSubmitInitials} />
  {:else}
  <p class="start_over">{getLocalizedText(pageTexts, "game_over_start_over")}</p>
  {#if !hasStarted}
  <button class="reset" on:click={resetGame}>{getLocalizedText(pageTexts, "start-game")}</button>
  {:else}
  <button class="reset" on:click={resetGame}>{getLocalizedText(pageTexts, "restart-game")}</button>
  {/if}
  {#if leaderboard && leaderboard.length > 0}
  <div class="leaderboard" tabindex="-1">
      <h2>{getLocalizedText(pageTexts, "high_score")}</h2>
      <table>
        <thead>
          <tr>
            <th class="rank">{getLocalizedText(pageTexts, "rank")}</th>
            <th class="initials">{getLocalizedText(pageTexts, "initials")}</th>
            <th class="points">{getLocalizedText(pageTexts, "leaderboard_score")}</th>
          </tr>
        </thead>
        <tbody>
          {#each leaderboard as { initials, points }, i}
            <tr>
              <td class="rank">{i + 1}.</td>
              <td class="initials">{initials}</td>
              <td class="points">{String(points).padStart(5, '0')}</td>
            </tr>
          {/each}
        </tbody>
      </table>
  </div>
  {/if}

  {/if}
</div>

<div bind:this={startOverlay} class="start-game-overlay { hasStarted ? 'hide' : ''}">
<p>{getLocalizedText(pageTexts, "first_start_game")}</p>
{#if !hasStarted}
<button class="reset" on:click={resetGame}>{getLocalizedText(pageTexts, "start-game")}</button>
{:else}
<button class="reset" on:click={resetGame}>{getLocalizedText(pageTexts, "restart-game")}</button>
{/if}
</div>
{/if}