export function stringToColor(str: string) {
    // Hash string to a number
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Convert hash to HSL hue
    const hue = hash % 360;
    // Background color: light pastel
    const background = `hsl(${hue}, 70%, 90%)`; // high lightness
    // Text color: darker shade
    const text = `hsl(${hue}, 70%, 20%)`; // lower lightness
    return { background, text };
}
