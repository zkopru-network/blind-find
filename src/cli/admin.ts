import { Command } from "commander";
import { Admin } from "../admin";

export const buildCommandAdmin = () => {
    const adminCommand = new Command('admin');
    adminCommand
        .command('addHub')
        .arguments('<hubRegistry>')
        .description('add a hub registry to the merkle tree', {
            hubRegistry: 'a HubRegistry object encoded in base64',
        })
        .action(async (hubRegistry: string) => {
            console.log(hubRegistry)
            throw new Error('No way');
            // TODO: Need contract!
            // const admin = new Admin();
        });
    return adminCommand;
}
