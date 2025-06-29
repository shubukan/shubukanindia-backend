const marksheetModel = require("../model/marksheetModel");
const marksheetPageModel = require("../model/marksheetPageModel");
const cloudinary = require("../config/cloudinary");

exports.createMarksheetPage = async (req, res) => {
  try {
    const bodyData = req.body;

    if (bodyData) {
      const createdData = await marksheetPageModel.create(bodyData);
      return res.status(201).send({
        status: true,
        message: "Marksheet page created",
        data: createdData,
      });
    }
  } catch {
    return res.status(500).send({
      status: false,
      message: "Internal Server Error!",
      error: err.message,
    });
  }
};

exports.getMarksheetPage = async (req, res) => {
  try {
    const marksheetPage = await marksheetPageModel.findOne({
      title: "Marksheet",
    });
    return res.status(200).send({
      status: true,
      message: "This is marksheet page data",
      data: marksheetPage,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: "Internal Server Error!",
      error: err.message,
    });
  }
};

exports.updateMarksheetPage = async (req, res) => {
  try {
    const bodyData = req.body;

    const updatedData = await marksheetPageModel.findOneAndUpdate(
      { title: "Marksheet" },
      { $set: bodyData },
      { new: true }
    );

    if (!updatedData) {
      return res.status(404).send({
        status: false,
        message: "Marksheet page not found",
      });
    }

    return res.status(200).send({
      status: true,
      message: "Marksheet page updated",
      data: updatedData,
    });
  } catch (err) {
    return res.status(500).send({
      status: false,
      message: "Internal Server Error!",
      error: err.message,
    });
  }
};

exports.createMarksheet = async (req, res) => {
  try {
    const bodyData = req.body;

    if (bodyData) {
      const existDojo = await marksheetModel.findOne({
        dojoName: bodyData.dojoName,
      });

      if (existDojo.length === 0) {
        // creating marksheet object to store
        const marksheetObject = {
          dojoName: bodyData.dojoName,
          password: bodyData.password,
          marksheet: [{ year: bodyData.year, link: bodyData.link }],
        };

        const newMarksheet = await marksheetModel.create(marksheetObject);

        return res.send(201).send({
          status: true,
          message: "New dojo & marksheet added!",
          data: newMarksheet,
        });
      }

      // if dojo exist
      const marksheetPage = await marksheetPageModel.findOne({
        title: "Marksheet",
      });
      const dojo = marksheetPage.dojoList.find(
        (item) => item.dojoName === bodyData.dojoName
      );
      // then check year and update
      if (!dojo.years.includes(bodyData.year)) {
        await marksheetPageModel.findOneAndUpdate(
          { title: "Marksheet" },
          { $set: { dojoList: [] } },
          { new: true }
        );
      }
    }
  } catch (err) {
    return res.status(500).send({
      status: false,
      message: "Internal Server Error!",
      error: err.message,
    });
  }
};

exports.getAMarksheet = async (req, res) => {
  try {
    const { dojoName, password, year } = req.body;

    if (dojoName && password) {
      const marksheet = await marksheetModel.findOne({
        dojoName: dojoName,
        password: password,
      });

      if (marksheet) {
        if (year) {
          const marksheetLink = marksheet.marksheet.filter(
            (item) => item.year === year
          ).link;
          return res.status(200).json(marksheetLink);
        } else {
          const marksheetLink =
            marksheet.marksheet[marksheet.marksheet.length - 1].link;
          return res.status(200).json(marksheetLink);
        }
      } else {
        return res.status(404).json({ message: "Marksheet not found" });
      }
    } else if (!dojoName && !password) {
      return res.status(400).json({
        message: "Enter your dojo name and password to check marksheet",
      });
    } else if (!dojoName) {
      return res.status(400).json({ message: "Select your dojo" });
    } else if (!password) {
      return res.status(400).json({ message: "Enter your password" });
    }
  } catch {
    return res.status(500).json({ message: error.message });
  }
};

exports.getAllMarksheet = async (req, res) => {
  try {
  } catch {}
};

exports.updateMarksheet = async (req, res) => {};

exports.updateMarksheet = async (req, res) => {};
