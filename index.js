const fs = require('fs'); // Read from the file system
const csv = require("fast-csv");
const lodashLib = require('lodash');
const libPhoneNumber = require('libphonenumber-js').parsePhoneNumberFromString

const File = {
  readFileCSV(file) {
    let csvFileData = [];

    fs.createReadStream(file)
      .pipe(csv.parse({ headers: false }))
      .on('error', error =>
        console.error(error)
      )
      .on('data', (data) => {
        csvFileData.push(data)
      })
      .on('end', () => {
        FormattingDataFromCSV.formattingData(csvFileData)
      })
  }
}

const FormattingDataFromCSV = {
  formattingData(inputedCSV) {
    let csvHeaderData = inputedCSV[0]
    let csvDataRows = inputedCSV.slice(1)

    const newHeader = FormattingDataFromCSV.formattingNewHeader(csvHeaderData)
    const formatedData = FormattingDataFromCSV.formattingDataCSV(newHeader, csvDataRows)
    SaveData.writtingDataOnJSONFile(formatedData)
  },

  formattingNewHeader(headerToFormat) {
    let newHeader = []
    let count = 0

    for (let i = 0; i < headerToFormat.length; i++) {
      let words = headerToFormat[i].split(" ")
      let obtainedWords = []
      if (words.length != 1) {
        if (headerToFormat[i][0] != " ") {
          obtainedWords.push(words[0])

          for (let j = 1; j < words.length; j++) {
            if (j !== ((words.length) -1)) {
              obtainedWords.push(words[j].slice(0, words[j].length -1))
            } else {
              obtainedWords.push(words[j])
            }
          }
          newHeader.push(obtainedWords)
          count++
        }
        else{
          newHeader[count-1] = lodashLib.concat(newHeader[count-1], words[1])
        }
      }
      else{
        newHeader.push(headerToFormat[i])
        count++
      }
    }
    return newHeader
  },

  formattingDataCSV(newHeader, csvDataRows) {
    let jsonOutputData = [];

    let indexes = []
    for (let i = 0; i < newHeader.length; i++) {
      for (let j = i+1; j < newHeader.length; j++) {
        if (newHeader[i] == newHeader[j]) {
          indexes.push(i)
          indexes.push(j)
        }
      }
    }

    let index;
    for (let i = 0; i < csvDataRows.length; i++) {
      let obj = {}
      let j = 0
      let field = true

      // Search for a repeated fields in csv
      let repeatedFields = false
      for (let j = 0; j < csvDataRows[i].length; j++) {
        for (let k = j+1; k < csvDataRows[i].length; k++) {
          (csvDataRows[i][j]!=="")&&(csvDataRows[i][j] === csvDataRows[i][k]) ? repeatedFields = true : repeatedFields = false
        }
      }

      index = lodashLib.findIndex(jsonOutputData,['eid', csvDataRows[i][1]])
      index != -1 ? field = false : field = true

      // Search all addresses field
      let addresses = []
      for (let l = 0; l < newHeader.length; l++) {
        if (Array.isArray(newHeader[l])) {
          if (newHeader[l][0] === "email") {
            let mailAddress = csvDataRows[i][l].split('/')
            let mailCount = 0

            do {
              adressesIndex = {}
              if (FormattingDataFromCSV.validatingEmail(mailAddress[mailCount])) {
                adressesIndex["type"] = newHeader[l][0]
                adressesIndex["tags"] = lodashLib.drop(newHeader[l])
                adressesIndex["address"] = FormattingDataFromCSV.correctingEmail(mailAddress[mailCount])
              }

              (Object.keys(adressesIndex).length != 0) ? addresses.push(adressesIndex) : ''
              mailCount++
            } while (mailCount < mailAddress.length);
          } else {
            let adressesIndex = {}
            try {
              const number = libPhoneNumber(csvDataRows[i][l], 'BR')
              if (number.isValid()) {
                adressesIndex["type"] = newHeader[l][0]
                adressesIndex["tags"] = lodashLib.drop(newHeader[l])
                adressesIndex["address"] = number.number
              }
            } catch(err) {
              err ? 'Error: ' + err : adressesIndex = {}
            }
            (Object.keys(adressesIndex).length != 0) ? addresses.push(adressesIndex) : ''
          }
        } else {
          if ((lodashLib.indexOf(indexes,l)) == -1) {
            if (field) {
              // Set the invisible field
              if (newHeader[l] === "invisible") {
                (csvDataRows[i][l] === "1") ? csvDataRows[i][l] = "true" : csvDataRows[i][l] = "false"
              }
              // Set the see_all field
              if (newHeader[l] === "see_all") {
                (csvDataRows[i][l] === "yes") ? csvDataRows[i][l] = "true" : csvDataRows[i][l] = "false"
              }
              obj[newHeader[l]] = csvDataRows[i][l]
            } else {
              if (newHeader[l] === "invisible") {
                (csvDataRows[i][l] === "1") ? jsonOutputData[index]["invisible"] = "true" : jsonOutputData[index]["invisible"] = "false"
              }
              if ((newHeader[l] === "see_all")) {
                (csvDataRows[i][l] === "yes") ? jsonOutputData[index]["see_all"] = "true" : jsonOutputData[index]["see_all"] = "false"
              }
            }
          } else {
            var classesMatrix = []
            classesMatrix = (csvDataRows[i][indexes[0]] !== '') ? classesMatrix.concat(csvDataRows[i][indexes[0]].replace(/\s+/g, '').split(/[/,]/)) : csvDataRows[i][indexes[0]]
            classesMatrix = (csvDataRows[i][indexes[1]] !== '') ? classesMatrix.concat(csvDataRows[i][indexes[1]].replace(/\s+/g, '').split(/[/,]/)) : csvDataRows[i][indexes[1]]
          }
        }
      }

      // When the csv file has repeated files
      if (repeatedFields) {
        let excludeRepeatedField = -1

        for (let j = 0; j < addresses.length; j++) {
          for(let k = j+1; k < addresses.length; k++) {
            if ((addresses[j]["type"]) === (addresses[k]["type"])) {
              if((addresses[j]["address"]) === (addresses[k]["address"])) {
                addresses[j]["tags"] = addresses[j]["tags"].concat(addresses[k]["tags"])
                excludeRepeatedField = k
              }
            }
          }
        }
        delete addresses[excludeRepeatedField]
        addresses = addresses.filter((field) => {
          return field != null;
        });
      }

      // Save data
      if (field) {
        obj["group"] = classesMatrix
        obj["addresses"] = addresses

        jsonOutputData.push(obj)
      } else {
        // Update the groups and addresses
        classesMatrix = jsonOutputData[index].group.concat(classesMatrix)
        addresses = jsonOutputData[index].addresses.concat(addresses)

        jsonOutputData[index]["group"] = classesMatrix
        jsonOutputData[index]["addresses"] = addresses

        field = true;
      }
    }

    return jsonOutputData
  },

  validatingEmail(mail) {
    const isValid = (/[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/gi.test(mail)) ? true : false
    return isValid
  },

  correctingEmail(mail) {
    const correctedMail = mail.replace(/ [^ ]+$/, '')
    return correctedMail
  }
}

const SaveData = {
  writtingDataOnJSONFile(data) {
    const outputFile = './output.json';
    const jsonString = JSON.stringify(data)
    fs.writeFile(outputFile,jsonString, err => {
      const hasError = err ? ('Error writing File',err) : ('Successfully wrote file')

      return hasError
    })
  }
}

const App = {
  init() {
    const inputFile = './input.csv';
    File.readFileCSV(inputFile)
  }
}

App.init()
