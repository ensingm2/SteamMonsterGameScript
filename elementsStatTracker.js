// WIP: this doesn't work yet.

//This just keeps track of the distribution of elements in lanes

var elementStats;
var levelNum = -1;

var elementStatTracker = setInterval(function() {
	// Check for new level
	if(levelNum != g_Minigame.CurrentScene().m_nCurrentLevel) {
		levelNum = g_Minigame.CurrentScene().m_nCurrentLevel;
		elementStats[levelNum] = {	0 : g_Minigame.CurrentScene().m_rgLaneData[0],
									1 : ,
									2 : ,
		}
	}
}, 5000)