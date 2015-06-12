# SteamMonsterGameScript
A Javascript automator for the 2015 Summer Steam Monster Minigame
###DISCLAIMER: I take no responsibility for the use of this program. See http://www.reddit.com/r/SteamMonsterGame/comments/39lszy/steam_is_banning_for_autoclickers_apparently/ for risks!###

##Basic Use:
Just load the script, and all automated processes will start immediately.
To load the script, copy/paste the code from minified.js (or automator.js if you're security-conscious) into your browser console, and hit return to run it.
To stop, run "stopAllAutos()" in the console.

##Specifics:
Any of the additions can be started or stopped individually:
- **autoClicker:** run "startAutoClicker()" or "stopAutoClicker()" in the console.
- **autoRespawner:** run "startAutoRespawner()" or "stopAutoRespawner()" in the console.
- **autoTargetSwapper:** run "startAutoTargetSwapper()" or "stopAutoTargetSwapper()" in the console.

##Variables:
Feel free to edit any variables to suit your needs
- **debug (default: false):** if true, logs all actions to the console.
- **clicksPerSecond (default: 100 [or 30 in minified_30cps.js]):** Number of clicks to be sent to the server each second.
- **autoClickerVariance (default: 10% of clicksPerSecond):** amount that the clicks per second can be randomized by (range is clicksPersecond +/- autoClickerVariance)
- **respawnCheckFreq (default: 5000ms):** Duration (in milliseconds) between checks to see if the player needs to be revived.
- **targetSwapperFreq (default: 1000ms):** Duration (in milliseconds) between checks to see if the player needs to change targets.

##Testing:
If you would like to test the script, you have a few options
1. Use a browser add-on such as Firebug for Firefox and view the POST data being sent to the server. This is the best testing method as you can see exactly what's being sent to the server.
2. If you're running in chrome and just want to make sure the scripts are running, type "debug=true" into the console, and it will enable debug console logs as things happen.

###Other Notes:
None