import { FC } from "react";
import { Badge } from "@heroui/badge";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Tooltip } from "@heroui/tooltip";
const IntegrityBadgeWarning: FC<{
    disabled: boolean;
    isWarning: boolean;
    className?: string;
    itemType: "product" | "company" | "customer";
    children: React.ReactNode;
}> = ({ disabled, itemType, children, isWarning, className }) => {
    return (<Tooltip isDisabled={disabled} color="warning" content={`This ${itemType} has been removed!`}>
      <Badge color="warning" className={`w-8 h-8 ${disabled ? "opacity-60" : "opacity-100"} -translate-y-6 ${className || ""}`} isInvisible={!isWarning} content={isWarning ? <WarningAmberRoundedIcon fontSize="small"/> : null}>
        {children}
      </Badge>
    </Tooltip>);
};
export default IntegrityBadgeWarning;
