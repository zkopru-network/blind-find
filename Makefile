
.PHONY = clean

CARGO_BIN_PATH = ~/.cargo/bin
CIRCOM_DIR = circuits/instance
BUILD_DIR = build

CIRCOMS = $(CIRCOM_DIR)/proofOfSMP.circom $(CIRCOM_DIR)/proofSuccessfulSMP.circom
R1CSS = $(CIRCOMS:$(CIRCOM_DIR)/%.circom=$(BUILD_DIR)/%.r1cs)
WASMS = $(CIRCOMS:$(CIRCOM_DIR)/%.circom=$(BUILD_DIR)/%.wasm)
PARAMS = $(CIRCOMS:$(CIRCOM_DIR)/%.circom=$(BUILD_DIR)/%.params)
PROVING_KEYS = $(CIRCOMS:$(CIRCOM_DIR)/%.circom=$(BUILD_DIR)/%_pk.json)
VERIFICATION_KEYS = $(CIRCOMS:$(CIRCOM_DIR)/%.circom=$(BUILD_DIR)/%_vk.json)

all: $(R1CSS) $(WASMS) $(PARAMS) $(PROVING_KEYS) $(VERIFICATION_KEYS)

clean:
	rm -rf build/

# Extract keys from params.
$(BUILD_DIR)/%_pk.json $(BUILD_DIR)/%_vk.json: $(BUILD_DIR)/%.params $(BUILD_DIR)/%.r1cs
	$(CARGO_BIN_PATH)/zkutil export-keys -c $(patsubst %.params,%.r1cs,$<) -p $< -r $(patsubst %.params,%_pk.json,$<) -v $(patsubst %.params,%_vk.json,$<)

# Compile circuits and perform trusted setup.
# NOTE: It will be more precise to consider not only the entry circom files,
#	but also the libraries used.
$(BUILD_DIR)/%.r1cs $(BUILD_DIR)/%.wasm $(BUILD_DIR)/%.params: $(CIRCOM_DIR)/%.circom
	@mkdir -p $(BUILD_DIR)
	node ./node_modules/circom/cli.js $< -r $(patsubst $(CIRCOM_DIR)/%.circom,$(BUILD_DIR)/%.r1cs,$<) -w $(patsubst $(CIRCOM_DIR)/%.circom,$(BUILD_DIR)/%.wasm,$<)
	$(CARGO_BIN_PATH)/zkutil setup -c $(patsubst $(CIRCOM_DIR)/%.circom,$(BUILD_DIR)/%.r1cs,$<) -p $(patsubst $(CIRCOM_DIR)/%.circom,$(BUILD_DIR)/%.params,$<)
