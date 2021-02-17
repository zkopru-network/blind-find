import { Command } from "commander";
import { PubKey, SNARK_FIELD_SIZE, stringifyBigInts } from "maci-crypto";
import { TProof, TProofIndirectConnection } from "../circuits";
import { ValueError } from "../exceptions";
import { User } from "../user";
import { bigIntToEthAddress } from "../web3";
import { IConfig } from "./configs";
import { CLIFailure } from "./exceptions";
import { base64ToObj, printObj, keypairToCLIFormat } from "./utils";

export const buildCommandUser = (config: IConfig) => {
  const command = new Command("user");
  command
    .description("user join hubs and search for others")
    .addCommand(buildCommandJoin(config))
    .addCommand(buildCommandSearch(config))
    .addCommand(buildCommandGetKeypair(config));
  return command;
};

const buildCommandJoin = (config: IConfig) => {
  const command = new Command("join");
  command
    .arguments("<hostname> <port> <hubPubkey>")
    .description("join a hub", {
      hostname: "hub's hostname",
      port: "hub's port",
      hubPubkey: "hub's public key in base64"
    })
    .action(
      async (hostname: string, portString: string, hubPubkeyB64: string) => {
        const port = Number(portString);
        const hubPubkey = base64ToObj(hubPubkeyB64) as PubKey;
        validatePubkey(hubPubkey);
        const {
          adminAddress,
          userKeypair,
          blindFindContract,
          db
        } = await loadUserSettings(config);
        const user = new User(userKeypair, adminAddress, blindFindContract, db);
        await user.join(hostname, port, hubPubkey);
      }
    );
  return command;
};

const buildCommandSearch = (config: IConfig) => {
  const command = new Command("search");
  command
    .arguments("<hostname> <port> <targetPubkey>")
    .description("search for a user through a hub", {
      hostname: "hub's hostname",
      port: "hub's port",
      targetPubkey: "target user's public key in base64"
    })
    .action(
      async (hostname: string, portString: string, targetPubkeyB64: string) => {
        const port = Number(portString);
        const targetPubkey = base64ToObj(targetPubkeyB64) as PubKey;
        validatePubkey(targetPubkey);
        const {
          adminAddress,
          userKeypair,
          blindFindContract,
          db
        } = await loadUserSettings(config);
        const user = new User(userKeypair, adminAddress, blindFindContract, db);
        const result = await user.search(hostname, port, targetPubkey);
        if (result === null) {
          console.log(`Not Found: user = '${targetPubkeyB64}'`);
          process.exit(1);
        } else {
          // Fake: {"pubkeyInitiator":["21832474361127537700629442257203235216351119147507069046706747626913259995444","18653945661494841232566954012321900756586611347917605621072824920299006046000"],"pubkeyTarget":["21832474361127537700629442257203235216351119147507069046706747626913259995444","18653945661494841232566954012321900756586611347917605621072824920299006046000"],"adminAddress":"0xe75B72f46f34D8505382a35f4832FF41761611bB","merkleRoot":"11006367961791971092113606774938408370281609027794134241388950976069851532161","proofOfSMP":{"proof":{"protocol":"groth","proof":"26ef49b80cd62a9d16434cb7b007844c93a75b05b616a70a54829ffa047f274d21799a311432c3c23a967c3ec0f4c3f039062fda290ccc25c53025f8749c53dd19b599872334cae18e1bd778576a3b1c6f9bc1487ad044491988cccd597e8d5106bf70d56f1ba25f0f121517f57ffbb5989d58171f540e75fcdd7d1d34626207196e29c0623f070997dc45e6f837e720299e52163047bd5906cd9c06b82527762fb7db42a92567d8e7ceb5aaf674df03a543bba18eb9c9988edc8e13f0e5035c15655425e1c1f465042e07e7222995caa19dc0ad57e9e946509a258418165d1906c13b582a0539e68255b2a6c51e39504d8362dc6878473d4538d19b295a3267","pi_a":["17610673484111509551119017701641925284920064250603048584394852696897013884749","15141176690187896969854486645799519416981633614059955133723557153781122356189","1"],"pi_b":[["3052123630632782835049955302266750576981010073550727514294735919981950820871","11628680143798054079545535213098965864499481147966439878428296585567939759441"],["21583550175887556836569475227622227330668318738157546746705826093962707141468","11502462549963793080705638047811880988536941623143130218382971139720751687542"],["1","0"]],"pi_c":["9677602141777422012348215596096728782363907581240536645907206058461751565593","3055288154936860031543056159328366312751723365808859570968907006889139253863","1"]},"publicSignals":["1","21832474361127537700629442257203235216351119147507069046706747626913259995444","18653945661494841232566954012321900756586611347917605621072824920299006046000","1320816249850685660514180836828158197007291650491","11006367961791971092113606774938408370281609027794134241388950976069851532161","3729498382552820177466427119125578008401467777409550104042926762398040109422","14432282952241605315394469798803511988989172961679266738747580395460222784622","13099685856932006446716641550229615158386487046153879537493597057023421140449","2054660785099392713960579548730203705713542728077417647073879559916894370201","5217642152185930262385331994167519677035786656297781709999705230652956526026","11053145480163425253981478056930840410675353482806421775845618740804377046660","8822014145997251218548450975690271008621316000697853440582857572180698317756","2587480446386446771896435022193504351779297432700070453056857398464349610092","5894283041153472159439608508714375972612299114336387762604862529127229447065","5293006705000177976279640209700700506150567729564070001692446075268437767192","9013450959138802908641341693781905205477307541362830833777112798924259010185","1253159389567226022386200930727435990625933004756769831892893954560295523824","16816261550918043106500831392638988172637132887567017477783180943790974965811","17439255784831129963190205020426700275118035860277807468670915372022106771660","9361277845103738307583872097712267418647288787845719178022338954264104896137","2234766000679806560458785152700141174046957774085649848635859509255025959343","12617426006339870664794690039145428820647396971521182505056300562255771067052","12847310169569397596832079056042711833312166084307676504125350817509414668013","8852398142532806449960000229603242663147823241025524807146069255209609514766","8307412054553218476400660773464937662654771764673756839930376871756133569908","16832412631337803309814240466488751929282799185623213996440037158123636881340","753379095261117004235156655286850959530363764803463556039789314379745806020","146203640307110176922180188905460153647807468220301864731613489841593734717","15141084722816881617435526909624327467293467538654311876473799366073740304083","2411680240796114478407685219214367003735530963010718411487534510314314229034","6770663465182855549599762990959202364304997519421520706173957934065326895074","1198208774332106309244207502528436477098673509584444216620612170511835674412","4956167681840187938494289235299647749571888070363489417495873517603607983851","2645202648878667522665900651349508490510939737370981613100205007133013916794","1292564334447456937569411351393003985060650633539384114283973548963083755524","12285916643144257109709413407527769456570833028409042436576953271524659209470","2163856704543418235378355174845232993846658138012574838724103198913376532445","18555076355821418242882085674411762342055090023663505179409321214826908067945","2462840993759906803167694390853935769113183081617498859195629513108164078810"]},"proofSuccessfulSMP":{"proof":{"protocol":"groth","proof":"2575875c9d34994e5a270ddda660633bdb656a1ff7f903a598ed8759232cbae923e0c93536dc353f0ca0ad3e72d9863fb37725756a306cbabed3416473e611dd05dc5842b9bf72acb3c5e0dc1807bc0505772f19e8d89750e3b5f7af9076113e19619b363b5d797d4831cb3ae0c47a0339eaa942a079085b9e0df4f06999c7d82f79255da8daae720f2a7e83e62185ae8e05c43f4b68347f8d5a659969db38122726130bc2f1db839187e158237237fec41b43188af05395764454a70639bc9c035fbcfe5029610aaf161503628f1b8620803adf9d677cb3e9ce55355f9de0981768660d6fd8f51ee3adaaff8e0b301e394c46e23ef5eccf389f8f71673b0a4a","pi_a":["16943230736787505144898299736371936929096188194000827504387663719305870883561","16228112128595012009436326137462870668357927561379587478114636845958140662237","1"],"pi_b":[["11480276612637913968138153646358696993587142199248613460105050811583568660440","2650879749764105172232198307085748484194137510368080978999729771961596121406"],["17707472733479049089031927889349270875951252537545725232050402220541050731676","21472750267924001375168231575035151883033856475027700225876743806535885076498"],["1","0"]],"pi_c":["1526093401485401453936461654127303823713365270541675122179169833469179977880","10587651952537673728349500554689537345663740701785686723398818619930539919946","1"]},"publicSignals":["1","21832474361127537700629442257203235216351119147507069046706747626913259995444","18653945661494841232566954012321900756586611347917605621072824920299006046000","12617426006339870664794690039145428820647396971521182505056300562255771067052","12847310169569397596832079056042711833312166084307676504125350817509414668013","15141084722816881617435526909624327467293467538654311876473799366073740304083","2411680240796114478407685219214367003735530963010718411487534510314314229034","12285916643144257109709413407527769456570833028409042436576953271524659209470","2163856704543418235378355174845232993846658138012574838724103198913376532445"]}}
          console.log(outputProofIndirectConnection(result));
        }
      }
    );
  return command;
};

const buildCommandGetKeypair = (config: IConfig) => {
  const command = new Command("getKeypair");
  command.description("get user's keypair").action(async () => {
    printObj(keypairToCLIFormat(config.getKeypair()));
  });
  return command;
};

const loadUserSettings = async (config: IConfig) => {
  const blindFindContract = config.getBlindFindContract();
  const adminAddress = await blindFindContract.getAdmin();
  const userKeypair = config.getKeypair();
  const db = config.getDB();
  return {
    blindFindContract,
    adminAddress,
    userKeypair,
    db
  };
};

const validatePubkey = (pubkey: PubKey) => {
  if (
    pubkey.length !== 2 ||
    typeof pubkey[0] !== "bigint" ||
    typeof pubkey[1] !== "bigint" ||
    pubkey[0] < BigInt(0) ||
    pubkey[0] >= SNARK_FIELD_SIZE ||
    pubkey[1] < BigInt(0) ||
    pubkey[1] >= SNARK_FIELD_SIZE
  ) {
    throw new ValueError(`invalid pubkey: ${pubkey}`);
  }
};

const stringifyProof = (proof: TProof) => {
  return {
    proof: stringifyBigInts(proof.proof),
    publicSignals: stringifyBigInts(proof.publicSignals),
  }
}

const outputProofIndirectConnection = (proof: TProofIndirectConnection) => {
  return JSON.stringify({
    pubkeySearcher: stringifyBigInts(proof.pubkeyA),
    pubkeyTarget: stringifyBigInts(proof.pubkeyC),
    adminAddress: bigIntToEthAddress(proof.adminAddress),
    merkleRoot: stringifyBigInts(proof.merkleRoot),
    proofOfSMP: stringifyProof(proof.proofOfSMP),
    proofSuccessfulSMP: stringifyProof(proof.proofSuccessfulSMP),
  });
}
