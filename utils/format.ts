
export const LEAGUE_CONFIG: Record<string, { name: string; color: string }> = {
    "Esoccer Battle - 8 mins play": { name: "Battle 8m", color: "#FF4C4C" },
    "Esoccer Battle Volta - 6 mins play": { name: "Battle Volta 6m", color: "#FFD700" },
    "Esoccer GT Leagues - 12 mins play": { name: "GT Leagues 12m", color: "#32CD32" },
    "Esoccer GT Leagues – 12 mins play": { name: "GT Leagues 12m", color: "#32CD32" }, // Handling potential typo in dash
    "Esoccer H2H GG League - 8 mins play": { name: "H2H GG 8m", color: "#8A2BE2" },
    "Esoccer Adriatic League - 10 mins play": { name: "Adriatic 10m", color: "#1E90FF" }
};

export const getLeagueConfig = (leagueName: string) => {
    return LEAGUE_CONFIG[leagueName] || { name: leagueName, color: "#6366f1" }; // Default primary color
};

export const formatDateSafe = (dateString: string) => {
    try {
        if (!dateString) return "-";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "-";
        
        // Format: DD/MM HH:mm
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        
        return `${day}/${month} ${hours}:${minutes}`;
    } catch (e) {
        return "-";
    }
};
