
.PHONY = clean

SNARKJS_BIN = ./node_modules/.bin/snarkjs
CIRCOM_DIR = circuits/instance
BUILD_DIR = build

PTAUS = pot18_final.ptau 

CIRCOMS = $(CIRCOM_DIR)/proofOfSMP.circom $(CIRCOM_DIR)/proofSuccessfulSMP.circom
R1CSS = $(CIRCOMS:$(CIRCOM_DIR)/%.circom=$(BUILD_DIR)/%.r1cs)
WASMS = $(CIRCOMS:$(CIRCOM_DIR)/%.circom=$(BUILD_DIR)/%.wasm)
SYMS = $(CIRCOMS:$(CIRCOM_DIR)/%.circom=$(BUILD_DIR)/%.sym)
ZKEYS = $(CIRCOMS:$(CIRCOM_DIR)/%.circom=$(BUILD_DIR)/%.zkey)

all: $(R1CSS) $(WASMS) $(SYMS) $(PTAUS) $(ZKEYS)

clean:
	rm -rf $(BUILD_DIR)

# Execute Powers of tau ceremony
# TODO: generate random texts for contribution
$(PTAUS):
	@mkdir -p $(BUILD_DIR)
	$(SNARKJS_BIN) powersoftau new bn128 19 $(BUILD_DIR)/pot18_0000.ptau -v
	$(SNARKJS_BIN) powersoftau contribute $(BUILD_DIR)/pot18_0000.ptau $(BUILD_DIR)/pot18_0001.ptau --name="First contribution" -v -e="FirstRandomText"
	$(SNARKJS_BIN) powersoftau contribute $(BUILD_DIR)/pot18_0001.ptau $(BUILD_DIR)/pot18_0002.ptau --name="Second contribution" -v -e="SecondRandomText"
	$(SNARKJS_BIN) powersoftau beacon $(BUILD_DIR)/pot18_0002.ptau $(BUILD_DIR)/pot18_beacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon"
	$(SNARKJS_BIN) powersoftau prepare phase2 $(BUILD_DIR)/pot18_beacon.ptau $(BUILD_DIR)/pot18_final.ptau -v

# Compile circuits and generate r1cs, wasm, sym files
$(BUILD_DIR)/%.r1cs $(BUILD_DIR)/%.wasm $(BUILD_DIR)/%.sym: $(CIRCOM_DIR)/%.circom
	@mkdir -p $(BUILD_DIR)
	node ./node_modules/circom/cli.js $< --r1cs $(patsubst $(CIRCOM_DIR)/%.circom,$(BUILD_DIR)/%.r1cs,$<) --wasm $(patsubst $(CIRCOM_DIR)/%.circom,$(BUILD_DIR)/%.wasm,$<) --sym $(patsubst $(CIRCOM_DIR)/%.circom,$(BUILD_DIR)/%.sym,$<)

zkeys: $(ZKEYS)

# generate zkeys for groth16
$(BUILD_DIR)/%.zkey: $(BUILD_DIR)/%.r1cs 
	$(SNARKJS_BIN) groth16 setup $(patsubst $(CIRCOM_DIR)/%.circom,$(BUILD_DIR)/%.r1cs,$<) $(BUILD_DIR)/pot18_final.ptau $@
	$(SNARKJS_BIN) zkey export verificationkey $@ $@.json
