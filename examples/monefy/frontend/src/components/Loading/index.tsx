import { FC, useEffect } from "react";
const Loading: FC<{
    message: string;
    onUnmount?: () => void;
}> = ({ message, }) => {
    useEffect(() => {
        function animateText(selector: string, waveDuration = 2, delayStep = 0.1, delay = 0.4) {
            const element = document.querySelector(selector) as HTMLSpanElement | undefined;
            if (!element)
                return;
            const text = element.innerText;
            element.innerHTML = ""; // Clear existing text
            text.split("").forEach((char, index) => {
                const span = document.createElement("span");
                span.innerHTML = char === " " ? "&nbsp;" : char;
                // Compute animation delay and duration
                const animationDelay = `${index * delayStep + delay}s`;
                const animationDuration = `${waveDuration}s`;
                // Combine into one animation property
                span.style.animation = `wave ${animationDuration} ease-in-out infinite`;
                span.style.animationDelay = animationDelay;
                function restartAnimation() {
                    span.style.animation = "none"; // Pause the animation
                    setTimeout(() => {
                        span.style.animation = `wave ${animationDuration} ease-in-out infinite`;
                    }, 1600); // Pause time in ms
                }
                element.appendChild(span);
                span.addEventListener("animationiteration", restartAnimation);
            });
        }
        animateText(".loading-text-animation", 1.5, 0.1);
        return () => { };
    }, []);
    return (<div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
        }} className="in-animation-03">
      <h2 className="loading-text-animation">{message}...</h2>
    </div>);
};
export default Loading;
