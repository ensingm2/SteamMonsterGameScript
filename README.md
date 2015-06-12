# SteamMonsterGameScript
A Javascript automator for the 2015 Summer Steam Monster Minigame

#Basic Use:
Just load the script, and all automated processes will start immediately.
To load the script, copy/paste the code from minified.js (or automator.js if you're security-conscious) into your browser console, and hit return to run it.
To stop, run "stopAllAutos()" in the console.

#Specifics:
Any of the additions can be started or stopped individually:
-autoClicker: run "startAutoClicker()" or "stopAutoClicker()" in the console.
-autoRespawner: run "startAutoRespawner()" or "stopAutoRespawner()" in the console.
-autoTargetSwapper: run "startAutoTargetSwapper()" or "stopAutoTargetSwapper()" in the console.

#Variables:
Feel free to edit any variables to suit your needs
-debug: if true, logs all actions to the console.
-clicksPerSecond: Number of clicks to be sent to the server each second.
-autoClickerVariance: amount that the clicks per second can be randomized by (range is clicksPersecond +/- autoClickerVariance)
-respawnCheckFreq: Duration (in milliseconds) between checks to see if the player needs to be revived.
-targetSwapperFreq: Duration (in milliseconds) between checks to see if the player needs to change targets.

#Other Notes:
None