"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
require("source-map-support/register");
const bip39 = __importStar(require("ethereum-cryptography/bip39"));
const english_1 = require("ethereum-cryptography/bip39/wordlists/english");
const EthUtil = __importStar(require("ethereumjs-util"));
const ethereumjs_wallet_1 = __importDefault(require("ethereumjs-wallet"));
const ethereumjs_wallet_2 = require("ethereumjs-wallet");
// @ts-ignore
const web3_provider_engine_1 = __importDefault(require("@trufflesuite/web3-provider-engine"));
const filters_1 = __importDefault(require("@trufflesuite/web3-provider-engine/subproviders/filters"));
const nonce_tracker_1 = __importDefault(require("@trufflesuite/web3-provider-engine/subproviders/nonce-tracker"));
const hooked_wallet_1 = __importDefault(require("@trufflesuite/web3-provider-engine/subproviders/hooked-wallet"));
// import ProviderSubprovider from "@trufflesuite/web3-provider-engine/subproviders/provider";
const ProviderSubprovider = require("./subproviders/provider.js");
// @ts-ignore
const rpc_1 = __importDefault(require("@trufflesuite/web3-provider-engine/subproviders/rpc"));
// @ts-ignore
const websocket_1 = __importDefault(require("@trufflesuite/web3-provider-engine/subproviders/websocket"));
const url_1 = __importDefault(require("url"));
const getOptions_1 = require("./constructor/getOptions");
const getPrivateKeys_1 = require("./constructor/getPrivateKeys");
const getMnemonic_1 = require("./constructor/getMnemonic");
const Caver = require("caver-js");
// Important: do not use debug module. Reason: https://github.com/trufflesuite/truffle/issues/2374#issuecomment-536109086
// This line shares nonce state across multiple provider instances. Necessary
// because within truffle the wallet is repeatedly newed if it's declared in the config within a
// function, resetting nonce from tx to tx. An instance can opt out
// of this behavior by passing `shareNonce=false` to the constructor.
// See issue #65 for more
const singletonNonceSubProvider = new nonce_tracker_1.default();
class HDWalletProvider {
    constructor(...args) {
        const _a = getOptions_1.getOptions(...args), { providerOrUrl, // required
        addressIndex = 0, numberOfAddresses = 10, shareNonce = true, derivationPath = `m/44'/60'/0'/0/`, pollingInterval = 4000 } = _a, 
        // what's left is either a mnemonic or a list of private keys
        signingAuthority = __rest(_a, ["providerOrUrl", "addressIndex", "numberOfAddresses", "shareNonce", "derivationPath", "pollingInterval"]);
        const mnemonic = getMnemonic_1.getMnemonic(signingAuthority);
        const privateKeys = getPrivateKeys_1.getPrivateKeys(signingAuthority);
        this.walletHdpath = derivationPath;
        this.wallets = {};
        this.addresses = [];
        this.engine = new web3_provider_engine_1.default({
            pollingInterval
        });
        if (!HDWalletProvider.isValidProvider(providerOrUrl)) {
            throw new Error([
                `Malformed provider URL: '${providerOrUrl}'`,
                "Please specify a correct URL, using the http, https, ws, or wss protocol.",
                ""
            ].join("\n"));
        }
        // private helper to check if given mnemonic uses BIP39 passphrase protection
        const checkBIP39Mnemonic = ({ phrase, password }) => {
            this.hdwallet = ethereumjs_wallet_2.hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(phrase, password));
            if (!bip39.validateMnemonic(phrase, english_1.wordlist)) {
                throw new Error("Mnemonic invalid or undefined");
            }
            // crank the addresses out
            for (let i = addressIndex; i < addressIndex + numberOfAddresses; i++) {
                const wallet = this.hdwallet
                    .derivePath(this.walletHdpath + i)
                    .getWallet();
                const addr = `0x${wallet.getAddress().toString("hex")}`;
                this.addresses.push(addr);
                this.wallets[addr] = wallet;
            }
        };
        // private helper leveraging ethUtils to populate wallets/addresses
        const ethUtilValidation = (privateKeys) => {
            // crank the addresses out
            for (let i = addressIndex; i < privateKeys.length; i++) {
                const privateKey = Buffer.from(privateKeys[i].replace("0x", ""), "hex");
                if (EthUtil.isValidPrivate(privateKey)) {
                    const wallet = ethereumjs_wallet_1.default.fromPrivateKey(privateKey);
                    const address = wallet.getAddressString();
                    this.addresses.push(address);
                    this.wallets[address] = wallet;
                }
            }
        };
        if (mnemonic && mnemonic.phrase) {
            checkBIP39Mnemonic(mnemonic);
        }
        else if (privateKeys) {
            ethUtilValidation(privateKeys);
        } // no need to handle else case here, since matchesNewOptions() covers it
        if (this.addresses.length === 0) {
            throw new Error(`Could not create addresses from your mnemonic or private key(s). ` +
                `Please check that your inputs are correct.`);
        }
        const tmp_accounts = this.addresses;
        const tmp_wallets = this.wallets;
        this.engine.addProvider(new hooked_wallet_1.default({
            getAccounts(cb) {
                cb(null, tmp_accounts);
            },
            getPrivateKey(address, cb) {
                if (!tmp_wallets[address]) {
                    return cb("Account not found");
                }
                else {
                    cb(null, tmp_wallets[address].getPrivateKey().toString("hex"));
                }
            },
            signTransaction(txParams, cb) {
                let pkey;
                const from = txParams.from.toLowerCase();
                if (tmp_wallets[from]) {
                    pkey = "0x" + tmp_wallets[from].getPrivateKey().toString("hex");
                }
                else {
                    cb("Account not found");
                }
                const caver = new Caver(providerOrUrl);
                txParams.gas = "0x500000";
                caver.klay.accounts
                    .signTransaction(txParams, pkey)
                    .then((r) => {
                    cb(null, r.rawTransaction);
                })
                    .catch(console.log);
            },
            signMessage({ data, from }, cb) {
                const dataIfExists = data;
                if (!dataIfExists) {
                    cb("No data to sign");
                }
                if (!tmp_wallets[from]) {
                    cb("Account not found");
                }
                let pkey = tmp_wallets[from].getPrivateKey();
                const dataBuff = EthUtil.toBuffer(dataIfExists);
                const msgHashBuff = EthUtil.hashPersonalMessage(dataBuff);
                const sig = EthUtil.ecsign(msgHashBuff, pkey);
                const rpcSig = EthUtil.toRpcSig(sig.v, sig.r, sig.s);
                cb(null, rpcSig);
            },
            signPersonalMessage(...args) {
                this.signMessage(...args);
            }
        }));
        !shareNonce
            ? this.engine.addProvider(new nonce_tracker_1.default())
            : this.engine.addProvider(singletonNonceSubProvider);
        this.engine.addProvider(new filters_1.default());
        if (typeof providerOrUrl === "string") {
            const url = providerOrUrl;
            const providerProtocol = (url_1.default.parse(url).protocol || "http:").toLowerCase();
            switch (providerProtocol) {
                case "ws:":
                case "wss:":
                    this.engine.addProvider(new websocket_1.default({ rpcUrl: url }));
                    break;
                default:
                    this.engine.addProvider(new rpc_1.default({ rpcUrl: url }));
            }
        }
        else {
            const provider = providerOrUrl;
            this.engine.addProvider(new ProviderSubprovider(provider));
        }
        // Required by the provider engine.
        this.engine.start((err) => {
            if (err)
                throw err;
        });
    }
    send(payload, callback) {
        return this.engine.send.call(this.engine, payload, callback);
    }
    sendAsync(payload, callback) {
        this.engine.sendAsync.call(this.engine, payload, callback);
    }
    getAddress(idx) {
        if (!idx) {
            return this.addresses[0];
        }
        else {
            return this.addresses[idx];
        }
    }
    getAddresses() {
        return this.addresses;
    }
    static isValidProvider(provider) {
        const validProtocols = ["http:", "https:", "ws:", "wss:"];
        if (typeof provider === "string") {
            const url = url_1.default.parse(provider.toLowerCase());
            return !!(validProtocols.includes(url.protocol || "") && url.slashes);
        }
        return true;
    }
}
module.exports = HDWalletProvider;
//# sourceMappingURL=index.js.map