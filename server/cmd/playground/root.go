package main

import (
	"fmt"

	"github.com/spf13/cobra"
)

const version = "0.1.0"

var rootCmd = &cobra.Command{
	Use:   "playground",
	Short: "OJS Playground — interactive Open Job Spec environment",
	Run: func(cmd *cobra.Command, args []string) {
		cmd.Help()
	},
}

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print the version",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("ojs-playground %s\n", version)
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}
