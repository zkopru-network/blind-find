export const abi = JSON.parse(`[{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"merkleRoot","type":"uint256"}],"name":"UpdateMerkleRoot","type":"event"},{"inputs":[],"name":"admin","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"latestMerkleRoot","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"root","type":"uint256"}],"name":"updateMerkleRoot","outputs":[],"stateMutability":"nonpayable","type":"function"}]`);
export const contractAddressInNetwork = {
    kovan: {
        address: "0xE57881D655309C9a20f469a95564beaEb93Ce73A",
        atBlock: 23208018
    }
};
