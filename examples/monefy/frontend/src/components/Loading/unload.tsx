import { FC, ReactNode, useEffect, useState } from "react";
const UnloadCoinAnimation: FC<{
    children: ReactNode;
}> = ({ children }) => {
    const [render, setRender] = useState(false);
    useEffect(() => {
        const coin = document.getElementById("global-loader");
        if (!coin)
            setRender(true);
        if (coin && coin.id === "global-loader") {
            coin.classList.add("fade-out");
            setTimeout(() => {
                setRender(true);
                document.body.style.cssText = "";
                coin.remove();
            }, 200);
        }
    }, []);
    if (!render)
        return null;
    return children;
};
export default UnloadCoinAnimation;
