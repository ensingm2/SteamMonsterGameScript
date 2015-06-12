// Compiled and costomized by reddit user /u/therusher
// Credit to reddit users /u/kolodz and /u/leandr0c for additional code

// Custom variables
var debug = false;
var clicksPerSecond = 500;
var autoClickerVariance = Math.floor(clicksPerSecond / 10);
var respawnCheckFreq = 5000;
var targetSwapperFreq = 1000;

// You shouldn't need to ever change this, you only push to server every 1s anyway
var autoClickerFreq = 1000;

// variables to store the setIntervals
var autoRespawner, autoClicker, autoTargetSwapper;

// ================ STARTER FUNCTIONS ================
function startAutoClicker() {
	if(autoClicker) {
		console.log("Autoclicker is already running!");
		return;
	}

	autoClicker = setInterval( function(){
		//Vary the number of clicks by up to the autoClickerVariance variable (plus or minus)
		var randomVariance = Math.floor(Math.random() * autoClickerVariance * 2) - (autoClickerVariance);
		var clicks = clicksPerSecond + randomVariance;
		
		//Set the variable to be sent to the server
		g_Minigame.m_CurrentScene.m_nClicks = clicks;

		if(debug)
			console.log('clicking ' + clicks + ' times this second.');
	}, autoClickerFreq);

	console.log("autoClicker has been started.");
}

function startAutoRespawner() {
	if(autoRespawner) {
		console.log("autoRespawner is already running!");
		return;
	}
	
	autoRespawner = setInterval( function(){
		if(debug)
			console.log('Checking if the player is dead.');

		
		// Credit to /u/kolodz for base code. http://www.reddit.com/r/SteamMonsterGame/comments/39joz2/javascript_auto_respawn/
		if(g_Minigame.m_CurrentScene.m_bIsDead) {
			if(debug)
				console.log('Player is dead. Respawning.');

			RespawnPlayer();
		}
	}, respawnCheckFreq);
	
	console.log("autoRespawner has been started.");
}

function startAutoTargetSwapper() {
	if(autoTargetSwapper) {
		console.log("autoTargetSwapper is already running!");
		return;
	}

	// Credit to /u/leandr0c for base code. http://www.reddit.com/r/SteamMonsterGame/comments/39l1wx/javascript_autosmart_clicker_respawner/
	autoTargetSwapper = setInterval(function() {
		var e=!1,
		a=!1,
		n=-1,
		t=-1,
		r=null;
		g_Minigame.m_CurrentScene.m_rgEnemies.each(function(m) {
			e || (2==m.m_data.type ? 
			(e =! 0, r = m) : n > 0 && 0 === m.m_data.type && m.m_data.hp < n ? 
			(n = m.m_data.hp, r = m) : 0>n && 0 === m.m_data.type ? 
			(n = m.m_data.hp, a =! 0, r = m) : t > 0 && !a && m.m_data.hp < t ?
			(t = m.m_data.hp, r = m) : 0 > t && !a && (t = m.m_data.hp, r = m)
			);
		});
		
		if(r)
			g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane != r.m_nLane && g_Minigame.CurrentScene().TryChangeLane(r.m_nLane);
		g_Minigame.CurrentScene().TryChangeTarget(r.m_nID);
	}, targetSwapperFreq);
	
	console.log("autoTargetSwapper has been started.");
}

function startAllAutos() {
	startAutoClicker();
	startAutoRespawner();
	startAutoTargetSwapper();
}

// ================ STOPPER FUNCTIONS ================
function stopAutoClicker() {
	if(autoClicker) {
		clearInterval(autoClicker);
		autoClicker = null;
		console.log("autoClicker has been stopped.");
	}
	else
		console.log("No autoClicker is running to stop.");
}
function stopAutoRespawner() {
	if(autoRespawner) {
		clearInterval(autoRespawner);
		autoRespawner = null;
		console.log("autoRespawner has been stopped.");
	}
	else
		console.log("No autoRespawner is running to stop.");
		
}
function stopAutoTargetSwapper() {
	if(autoTargetSwapper){
		clearInterval(autoTargetSwapper);
		autoTargetSwapper = null;
		console.log("autoTargetSwapper has been stopped.");
	}
	else
		console.log("No autoTargetSwapper is running to stop.");
}

function stopAllAutos() {
	stopAutoClicker();
	stopAutoRespawner();
	stopAutoTargetSwapper();
}

//Start all autos
startAllAutos();