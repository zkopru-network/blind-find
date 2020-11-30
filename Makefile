
.PHONY = clean

CIRCOM_DIR = src/circuits/circom/instance
BUILD_DIR = build

# R1CSS = $(CIRCOMS:%.circom=$(BUILD_DIR)/%.r1cs)

all: proof-smp proof-successful-smp

clean:
	rm -rf build/

proof-smp: $(BUILD_DIR)/proofOfSMP.r1cs

proof-successful-smp: $(BUILD_DIR)/proofSuccessfulSMP.r1cs

$(BUILD_DIR)/%.r1cs $(BUILD_DIR)/%.wasm $(BUILD_DIR)/%.params $(BUILD_DIR)/%_pk.json $(BUILD_DIR)/%_vk.json: $(CIRCOM_DIR)/%.circom
	@mkdir -p $(BUILD_DIR)
	./scripts/buildScript.sh $<
