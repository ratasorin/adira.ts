import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/auth";
import { displayError } from "../../utils/handle-error";
import { addToast } from "@heroui/toast";
import { motion } from "framer-motion";
import Toolbar from "@mui/material/Toolbar";
import { Button } from "@heroui/button";
import CreateRoundedIcon from "@mui/icons-material/CreateRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import ExitToAppRoundedIcon from "@mui/icons-material/ExitToAppRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import { Tooltip } from "@heroui/tooltip";
import { DockRoundedIcon } from "./assets/dock-rounded.icon";
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, } from "@heroui/dropdown";
export const SidebarToggle = ({ toggleMenu }: {
    toggleMenu: () => void;
}) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const handleLogout = async () => {
        try {
            await logout();
            navigate("/login");
            addToast({ color: "success", title: "Successfully logged out!" });
        }
        catch (err) {
            displayError(err);
        }
    };
    return (<Toolbar component={motion.div} transition={{
            duration: 0.2,
            ease: "easeInOut",
        }} initial={{
            opacity: 0,
            x: 100,
        }} animate={{
            opacity: 1,
            x: 0,
        }} exit={{
            opacity: 0,
            x: 100,
        }} sx={{
            display: "flex",
            justifyContent: "space-between",
            flexDirection: "column",
            alignItems: "start",
            width: "auto",
            height: "100vh",
            maxWidth: "min-content",
            padding: "24px !important",
        }}>
      <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            alignItems: "center",
        }}>
        <Button isIconOnly variant="light" onPress={() => {
            navigate("/");
        }}>
          <PaidRoundedIcon style={{ color: "#598c75", fontSize: "40px" }}/>
        </Button>

        <Tooltip content="Open Sidebar" placement="right" closeDelay={0}>
          <Button isIconOnly variant="light" onPress={toggleMenu} aria-label="Open Sidebar">
            <DockRoundedIcon />
          </Button>
        </Tooltip>

        <Tooltip content="Create New Invoice" placement="right" closeDelay={0}>
          <Button color="primary" isIconOnly variant="solid" className="mt-8" onPress={() => {
            navigate("/");
        }}>
            <CreateRoundedIcon />
          </Button>
        </Tooltip>
      </div>
      <Dropdown placement="right-end" style={{ marginLeft: "12px" }}>
        <DropdownTrigger>
          <Button aria-label="Account menu" radius="full" className="text-3xl items-start" isIconOnly variant="shadow" color="primary">
            {user?.username.slice(0, 1)}
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Static Actions">
          <DropdownItem onPress={() => navigate("/profile")} key="profile" startContent={<PersonRoundedIcon />}>
            Profile
          </DropdownItem>
          <DropdownItem onPress={() => {
            handleLogout();
        }} key="delete" className="text-danger" color="danger" startContent={<ExitToAppRoundedIcon />}>
            Logout
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </Toolbar>);
};
