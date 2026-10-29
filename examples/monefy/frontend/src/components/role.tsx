import { Chip } from "@heroui/chip";
import { IUser } from "@monefy/types/src/models/User";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import DoneRoundedIcon from "@mui/icons-material/DoneRounded";
import { FC } from "react";
const RoleChip: FC<{
    role: IUser["role"];
}> = ({ role }) => {
    return (<Chip radius="sm" color="primary" variant="flat" size="sm" className="flex gap-1" endContent={role === "ADVANCED" ? (<AutoAwesomeRoundedIcon className="mr-1" style={{ fontSize: "16px" }}/>) : (<DoneRoundedIcon className="mr-1" style={{ fontSize: "16px" }}/>)}>
      {role}
    </Chip>);
};
export default RoleChip;
