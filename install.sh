#!/bin/sh

# Globally installing zx
npm install -g zx n
# we need node >= 14 with top-level await in order to make zx work
sudo n install 14

# Installing gcloud utilities
# see https://discuss.bitrise.io/t/add-google-cloud-cli-gcloud-gsutil-to-mac-stacks/8581/9
export CLOUDSDK_CONFIG=/Users/vagrant/git/.config/
curl -sSL https://sdk.cloud.google.com > /tmp/gcl && bash /tmp/gcl --install-dir=$HOME/gcloud --disable-prompts

echo 'export PATH="$PATH:$HOME/gcloud/google-cloud-sdk/bin"' >> $HOME/.bashrc
echo '' >> $HOME/.bashrc
echo 'export PATH="$PATH:$HOME/gcloud/google-cloud-sdk/bin"' >> $HOME/.zshrc
echo '' >> $HOME/.zshrc

ln -s "$HOME/gcloud/google-cloud-sdk/bin/gcloud" "$HOME/bin/gcloud"
ln -s "$HOME/gcloud/google-cloud-sdk/bin/gsutil" "$HOME/bin/gsutil"