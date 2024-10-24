const dojoModel = require("../model/dojoModel");

exports.createDojo = async (req, res) => {
  try {
    const data = req.body;

    // let exData = await dojoModel.findOne({
    //   $or: [{ reg: data.reg }, { name: data.name }],
    // });

    // if (exData) {
    //   return res.status(200).send({
    //     status: false,
    //     message: "Registration no. / Dealer name already exist !",
    //   });
    // }

    let createdData = await dojoModel.create(data);
    return res.status(201).send({
      status: true,
      message: "dojo created successfully 😃",
      data: createdData,
    });
  } catch (err) {
    return res.status(500).send({
      status: false,
      message: "Internal Server Error!",
      error: err.message,
    });
  }
};

exports.fetchDojo = async (req, res) => {
  try {
    const cars = await dojoModel.find();

    return res.status(200).send({
      status: true,
      data: cars,
    });
  } catch (err) {
    return res.status(500).send({
      status: false,
      message: "Internal Server Error!",
      error: err.message,
    });
  }
};
