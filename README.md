setup project
1.yarn add --dev hardhat
2.yarn hardhat ambik yg kosong
3.yarn add --dev @nomiclabs/hardhat-ethers@npm:hardhat-deploy-ethers ethers @nomiclabs/hardhat-etherscan @nomiclabs/hardhat-waffle chai ethereum-waffle hardhat hardhat-contract-sizer hardhat-deploy hardhat-gas-reporter prettier prettier-plugin-solidity solhint solidity-coverage dotenv
4.sblm buat deploy kita masuk dulu data yang perlu ke helper-hardhat-config.js
5.untuk deploy punya kita code ikut susunan constructor contract
6.lps tu kita buat utils folder and verify.js ni copy je sbb sama mana2 pun
7.lps tu buat unit test dulu sblm deploy ke testnet
8.kalau nak hh test tapi dkt sesuatu line je blh pakai hh test --grep pilih perkataan apa yg dkt describe