<!-- Message.svelte -->
<script>
    export let type = 'info'; // 'winner', 'level', 'info', 'error', 'gameover'
    export let message = '';
    export let congrats_title = 'Congratulations!';
    export let level_title = '"Level cleared!"';
  </script>
  
  <div class="message {type}">
    {#if type === 'winner'}
      <p class="congrats">{congrats_title}!</p>
      <p class="winner">{message}</p>
    {/if}
    {#if type === 'level'}
      <p class="level">{level_title}</p>
      <p class="level-info">{message}</p>
    {/if}
    {#if type !== 'level' && type !== 'winner'}
      <p class="message">{message}</p>
    {/if}
  </div>
  
  <style>
    div.message {
      padding: 20px;
      margin-top: 20px;
      border-radius: 8px;
      text-align: center;
      font-size: 1.5rem;
      font-weight: bold;
    }
  
    div.message.info {
      color: #e0f7fa;
    }
  
    div.message.error {
      background-color: #ffebee;
      color: #c62828;
    }
  
    div.message.gameover {
      background-color: #f44336;
      color: #ffebee;
    }

    div.message.winner p.congrats {
      color: #ffd700; /* Golden color */
      margin-bottom: 15px;
      font-size: 120%;
      text-shadow: 
        0 0 5px #ffd700,  /* Inner glow */
        0 0 10px #ffd700, /* Slightly outer glow */
        0 0 20px #ffd700, /* Further outer glow */
        0 0 40px #ff8c00;
    }
    
    div.message.level p.level {
      margin-bottom: 15px;
      font-size: 120%;
      color: #c0c0c0; /* Silver color */
      text-shadow: 
        0 0 20px #ffffff, /* Further outer glow with a lighter shade */
        0 0 40px #ffffff;
      font-weight: bold;        
    }
    
    div.message p {
      margin: 0;
    }

    div.message p.congrats {
      font-weight: normal;
    }

    div.message.winner p.message,
    p.winner,
    div.message p.level-info {
      margin: 0;
      margin-top: 30px;
      margin-bottom: -10px;
      font-size: 80%;
      font-weight: normal;
      font-family: 'Courier New', Courier, monospace;
    }



  </style>
  