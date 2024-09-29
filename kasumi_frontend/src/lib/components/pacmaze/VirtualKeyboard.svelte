<script>
    export let onSubmit;
  
    let initials = '';
  
    function addLetter(letter) {
      if (initials.length < 3) {
        initials += letter;
      }
    }
  
    function removeLetter() {
      initials = initials.slice(0, -1);
    }
  
    function submit() {
      onSubmit(initials);
    }
  </script>
  

  <p>Your initials: <span>
    {#each Array.from({ length: 3 }, (_, i) => initials[i] || ' _ ') as letter}
      {letter}
    {/each}
  </span></p>
  <div class="keyboard">
    {#each 'abcdefghijklmnopqrstuvwxyz'.split('') as letter}
      <button class="letter" on:click={() => addLetter(letter)}>{letter}</button>
    {/each}
    <button class="remove" on:click={removeLetter}>⌫</button>
    <button class="submit" on:click={submit} disabled={initials.length === 0}>Submit</button>
  </div>  
  
  <style>
    .keyboard {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      margin-top: 0px;
      width: 400px;
    }
  
    button {
      margin: 5px;
      padding: 10px;
      font-size: 1.2rem;
      text-transform: uppercase;
    }
  
    p {
      display: block;
      text-align: center;
      margin-left: 20px;
      width: 400px;
      margin-top: 10px;
      margin-bottom: 10px;
      font-size: 1.5rem;
    }

    p span {
      text-transform: uppercase;
    }

    button.letter {
      width: 45px;
    }

    button.remove {
      width: 100px;
    }

    button.submit {
      width: 150px;
      margin-top: 20px;
      margin-bottom: 20px;
      background-color: #0b5d0b;
      color: #ffffff;
      padding: 12px 24px;
      font-size: 1.2rem;
      font-weight: bold;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 6px 10px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;
      text-transform: uppercase;
      letter-spacing: 1px;      
    }

    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 15px rgba(0, 0, 0, 0.3);
    }

    button:active {
      transform: translateY(2px);
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
      background-color: #f0b300;
    }

    
  </style>
  