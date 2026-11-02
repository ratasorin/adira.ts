import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownSection, DropdownTrigger, } from "@heroui/react";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import LocalMallRoundedIcon from "@mui/icons-material/LocalMallRounded";
import StoreRoundedIcon from "@mui/icons-material/StoreRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useAuth } from "../context/auth";
import UserTable from "../components/profile/user/table";
import ProductTable from "../components/profile/products/table";
import CustomerTable from "../components/profile/customers/table";
import CompanyTable from "../components/profile/company/table";
import { useMemo } from "react";
const Profile = () => {
    const { user: currentUser } = useAuth();
    const sections = useMemo(() => [
        {
            id: "users",
            hide: currentUser?.role !== "ADVANCED",
            label: "Users",
            icon: (<GroupRoundedIcon fontSize="small" className="text-foreground-600"/>),
        },
        {
            id: "companies",
            label: "Companies",
            icon: (<ApartmentRoundedIcon fontSize="small" className="text-foreground-600"/>),
        },
        {
            id: "customers",
            label: "Customers",
            icon: (<StoreRoundedIcon fontSize="small" className="text-foreground-600"/>),
        },
        {
            id: "products",
            label: "Products",
            icon: (<LocalMallRoundedIcon fontSize="small" className="text-foreground-600"/>),
        },
    ], [currentUser?.role]);
    return (<>
      <div className="flex flex-col gap-12 overflow-auto">
        <div className="w-full flex justify-between items-start">
          <div className="flex flex-col gap-5 items-start">
            <span className="flex items-center text-2xl font-semibold gap-3">
              <img src="men-tech.png" className="inline w-9" alt=""/>
              Profile
              <Dropdown>
                <DropdownTrigger>
                  <Button isIconOnly variant="light">
                    <KeyboardArrowRightRoundedIcon fontSize="large"/>
                  </Button>
                </DropdownTrigger>
                <DropdownMenu>
                  <DropdownSection showDivider>
                    {sections.map((item) => item.hide ? null : (<DropdownItem key={item.id} onPress={() => {
                const target = document.getElementById(item.id);
                if (target) {
                    // Adjust if needed for fixed headers
                    target.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                    });
                }
            }} startContent={item.icon}>
                          {item.label}
                        </DropdownItem>))}
                  </DropdownSection>
                  <DropdownSection>
                    <DropdownItem key="back" href="/" startContent={<ArrowBackRoundedIcon fontSize="small" className="text-foreground-600"/>}>
                      Create Invoice
                    </DropdownItem>
                  </DropdownSection>
                </DropdownMenu>
              </Dropdown>
            </span>
          </div>
          <div className="flex flex-col gap-2 items-center">
            <div className="text-4xl flex gap-4 items-center">
              <span className="font-semibold">
                Hello {currentUser?.username}
              </span>{" "}
              <img src="waving-hand.png" className="inline w-8 h-8" alt=""/>
            </div>
            <p className="text-foreground-500">
              Hope you have a great day{" "}
              <img src="sun.png" className="inline w-5" alt=""/>
            </p>
          </div>
          <Button isIconOnly color="default" variant="flat">
            <SettingsRoundedIcon />
          </Button>
        </div>

        {currentUser?.role === "ADVANCED" && <UserTable />}
        <ProductTable></ProductTable>
        <CustomerTable></CustomerTable>
        <CompanyTable />
      </div>
    </>);
};
export default Profile;
