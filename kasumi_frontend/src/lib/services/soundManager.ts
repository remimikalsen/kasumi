// Sound Manager for Battleship Game
type SoundEffects = 'shot' | 'hit' | 'missed' | 'sinking';

class SoundManager {
  private backgroundMusic: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private soundBuffers: Record<string, AudioBuffer> = {};
  
  private isMusicEnabled: boolean = true;
  private isSoundEffectsEnabled: boolean = true;
  private isInitialized: boolean = false;
  
  // Fade settings for background music
  private crossfadeDuration: number = 2; // seconds
  private musicVolume: number = 0.5;
  
  constructor() {
    // Sound will be initialized on user interaction
  }
  
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Preload sound effects
      await Promise.all([
        this.loadSoundEffect('shot', '/sound/battleship/shot.mp3'),
        this.loadSoundEffect('hit', '/sound/battleship/hit.mp3'),
        this.loadSoundEffect('missed', '/sound/battleship/missed.mp3'),
        this.loadSoundEffect('sinking', '/sound/battleship/sinking.mp3')
      ]);
      
      // Initialize background music with crossfade capability
      this.initializeBackgroundMusic();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize sound manager:', error);
    }
  }
  
  private async loadSoundEffect(name: string, url: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load sound "${name}"`);
      }
      const arrayBuffer = await response.arrayBuffer();
      if (this.audioContext) {
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        this.soundBuffers[name] = audioBuffer;
      }
    } catch (error) {
      console.error(`Error loading sound ${name}:`, error);
    }
  }
  
  private initializeBackgroundMusic(): void {
    this.backgroundMusic = new Audio('/sound/battleship/soundtrack-6.mp3');
    this.backgroundMusic.loop = true;
    this.backgroundMusic.volume = 0;  // Start at 0 volume for fade in
    
    // Set up fading
    this.backgroundMusic.addEventListener('timeupdate', () => {
      if (!this.backgroundMusic) return;
      
      // Get duration and current time
      const duration = this.backgroundMusic.duration;
      const currentTime = this.backgroundMusic.currentTime;
      
      // Apply fade in at start
      if (currentTime < this.crossfadeDuration) {
        const fadeInVolume = Math.min(currentTime / this.crossfadeDuration, 1) * this.musicVolume;
        this.backgroundMusic.volume = this.isMusicEnabled ? fadeInVolume : 0;
      } 
      // Apply fade out near end
      else if (currentTime > duration - this.crossfadeDuration) {
        const fadeOutVolume = Math.max((duration - currentTime) / this.crossfadeDuration, 0) * this.musicVolume;
        this.backgroundMusic.volume = this.isMusicEnabled ? fadeOutVolume : 0;
      } 
      // Normal volume in the middle
      else {
        this.backgroundMusic.volume = this.isMusicEnabled ? this.musicVolume : 0;
      }
    });
  }
  
  public startBackgroundMusic(): void {
    if (!this.backgroundMusic || !this.isMusicEnabled) return;
    
    this.backgroundMusic.play().catch(error => {
      console.error('Failed to play background music:', error);
    });
  }
  
  public stopBackgroundMusic(): void {
    if (this.backgroundMusic) {
      this.backgroundMusic.pause();
      this.backgroundMusic.currentTime = 0;
    }
  }
  
  public playSound(name: SoundEffects): void {
    if (!this.audioContext || !this.isSoundEffectsEnabled) return;
    
    const buffer = this.soundBuffers[name];
    if (buffer) {
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);
    } else {
      console.warn(`Sound "${name}" not found or not loaded yet.`);
    }
  }
  
  public toggleMusic(): boolean {
    this.isMusicEnabled = !this.isMusicEnabled;
    
    if (this.backgroundMusic) {
      if (this.isMusicEnabled) {
        this.backgroundMusic.volume = 0; // Start at 0 for fade in
        this.startBackgroundMusic();
      } else {
        this.backgroundMusic.volume = 0;
      }
    }
    
    return this.isMusicEnabled;
  }
  
  public toggleSoundEffects(): boolean {
    this.isSoundEffectsEnabled = !this.isSoundEffectsEnabled;
    return this.isSoundEffectsEnabled;
  }
  
  public isMusicOn(): boolean {
    return this.isMusicEnabled;
  }
  
  public isSoundEffectsOn(): boolean {
    return this.isSoundEffectsEnabled;
  }
}

// Create singleton instance
export const soundManager = new SoundManager(); 