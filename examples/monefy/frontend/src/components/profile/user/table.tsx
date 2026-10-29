import { expectSuccess } from "../../../services/api";
import { addToast, Button, Chip, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure, } from "@heroui/react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import { useAuth } from "../../../context/auth";
import { displayError } from "../../../utils/handle-error";
import z from "zod";
import DashboardTable, { useDashboardTable, withRowMetadata, } from "../../dashboard/table";
import DoneRoundedIcon from "@mui/icons-material/DoneRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import RoleChip from "../../role";
import { api } from "../../../services/api";
import { useRef } from "react";
import { nanoid } from "nanoid";
const monefyEmailValidation = z
    .email({
    pattern: /^[a-zA-Z0-9._%+-]+@([a-zA-Z0-9-]+\.)*monefy\.ro$/,
    error: "Please use a monefy email",
})
    .min(10, "Email should have more than 10 characters");
const usernameValidation = z
    .string()
    .nonempty("Cannot allow empty usernames!")
    .min(5, "Username should be at least 5 characters");
const checkErros = (validator: z.ZodType, value: string | number | boolean) => {
    const result = validator.safeParse(value);
    if (!result.success) {
        return z.treeifyError(result.error).errors;
    }
    return [];
};
const USER_TABLE_ID = "profile-page__user-table";
const UserTable = () => {
    const { user: currentUser } = useAuth();
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const userDashboardProps = useDashboardTable({
        get: async () => {
            try {
                return await api("/users", "GET")({
                    query: {include: [], 
                        rows: r => r({
                            select: [
                                "_id",
                                "created_by",
                                "email",
                                "isAdminCreated",
                                "isVerified",
                                "role",
                                "username",
                            ]
                        })
                    },
                }).run().then(expectSuccess).then((res) => {
                    return res?.rows.map(withRowMetadata) || [];
                });
            }
            catch (error) {
                displayError(error, "[ERROR] Fetch users");
                return [];
            }
        },
        table: { elements: "users", id: USER_TABLE_ID },
    });
    const resolvedDeleteRef = useRef<(value: boolean) => void>(() => { });
    return (<>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (<>
              <ModalHeader className="flex gap-1">
                Delete <b>{userDashboardProps.itemToDelete?.username}</b>
              </ModalHeader>
              <ModalBody>
                <p>
                  This action will <b>permanently delete</b> this user, but
                  leave any artifacts (
                  <i>invoices, created users, companies, clients, products</i>)
                  unaffected
                </p>
              </ModalBody>
              <ModalFooter>
                <Button color="primary" variant="light" onPress={() => {
                onClose();
            }}>
                  Cancel
                </Button>
                <Button color="danger" onPress={async () => {
                if (!userDashboardProps.itemToDelete) {
                    addToast({
                        color: "danger",
                        title: "[Error] Delete user",
                        description: "There was no user selected for this action!",
                    });
                    return;
                }
                try {
                    await api("/users/:id", "DELETE")({data: {},                         path: { id: userDashboardProps.itemToDelete?._id },
                    }).run().then(expectSuccess).then(() => { });
                    resolvedDeleteRef.current(true);
                }
                catch (error) {
                    displayError(error, "[Error] Delete user");
                    resolvedDeleteRef.current(false);
                }
                finally {
                    onClose();
                }
            }}>
                  Delete
                </Button>
              </ModalFooter>
            </>)}
        </ModalContent>
      </Modal>
      {currentUser?.role === "ADVANCED" ? (<ClickAwayListener onClickAway={() => {
                userDashboardProps.resetTableState();
            }}>
          <div className="w-full p-5 bg-foreground-50 rounded-lg flex gap-5 flex-col" id="users">
            <div className="w-full flex justify-between items-center">
              <h2 className="font-semibold text-2xl flex items-center gap-3">
                <PersonRoundedIcon className="text-foreground-50 !text-3xl bg-foreground-600 rounded-lg"/>
                Users
              </h2>
              <Button color="primary" className="uppercase font-medium" variant="flat" onPress={() => {
                userDashboardProps.addNewItem({
                    rowId: nanoid(),
                    _id: "",
                    created_by: "",
                    email: "@monefy.ro",
                    isVerified: false,
                    isAdminCreated: currentUser.role === "ADVANCED",
                    role: "BASIC",
                    username: "",
                    createMode: true,
                    errors: {
                        username: checkErros(usernameValidation, ""),
                        email: checkErros(monefyEmailValidation, "@monefy.ro"),
                    },
                });
            }}>
                Add User
                <AddRoundedIcon />
              </Button>
            </div>

            <DashboardTable {...userDashboardProps} forbidDelete={(el) => !el.created_by} onDelete={() => {
                // open the confirmation modal
                onOpen();
                return new Promise((resolve) => {
                    resolvedDeleteRef.current = resolve;
                });
            }} onCreate={async (user) => {
                try {
                    await api("/users", "POST")({
                        data: {
                            email: user.email,
                            role: user.role,
                            username: user.username,
                            
                        },
                        query: {include: [], 
                            rows: r => r({
                                select: [] as []
                            })
                        },
                    }).run().then(expectSuccess).then(() => { });
                    addToast({
                        color: "success",
                        title: `[Success] Crated user`,
                        description: `User ${user.username} has been successfully created!`,
                    });
                    return true;
                }
                catch (error) {
                    displayError(error, "[ERROR] Create user");
                    return false;
                }
            }} onUpdate={async (user) => {
                try {
                    await api("/users/:id", "PATCH")({                        path: { id: user._id },
                        data: user,
                    }).run().then(expectSuccess).then(() => { });
                    addToast({
                        color: "success",
                        title: `[Success] Modified user`,
                        description: `User ${user.username} has been successfully updated!`,
                    });
                    return true;
                }
                catch (error) {
                    displayError(error, "Update user");
                    return false;
                }
            }} columnSet={{
                username: {
                    name: "Username",
                    isEditable: true,
                    renderParams: {
                        inputType: "TEXT",
                        validators: [usernameValidation],
                    },
                    render(el) {
                        return <div>{el}</div>;
                    },
                },
                email: {
                    name: "Email",
                    renderParams: {
                        inputType: "TEXT",
                        validators: [monefyEmailValidation],
                    },
                    render: (el) => {
                        return <div>{el}</div>;
                    },
                },
                isVerified: {
                    name: "Is Verified",
                    isEditable: true,
                    renderParams: {
                        inputType: "CHECKBOX",
                        checkedText: "Verified",
                        uncheckedText: "Unverified",
                    },
                    render: (verified) => {
                        return (<Chip className="capitalize" color={verified ? "success" : "danger"} size="sm" variant="flat" classNames={{
                                content: "flex flex-row items-center gap-1",
                            }}>
                        {verified ? (<>
                            VERIFIED
                            <DoneRoundedIcon className="!text-base"/>
                          </>) : (<>
                            UNVERIFIED
                            <CloseRoundedIcon className="!text-base"/>
                          </>)}
                      </Chip>);
                    },
                },
                role: {
                    name: "Role",
                    render: (r) => {
                        return <RoleChip role={r}></RoleChip>;
                    },
                    isEditable: true,
                    renderParams: {
                        inputType: "DROPDOWN",
                        renderer: (option) => {
                            return option;
                        },
                        key: (option) => option,
                        options: () => ["ADVANCED", "BASIC"] as const,
                    },
                },
            }}/>
          </div>
        </ClickAwayListener>) : (<></>)}
    </>);
};
export default UserTable;
